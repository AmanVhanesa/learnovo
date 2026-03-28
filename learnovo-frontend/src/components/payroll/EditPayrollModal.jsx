import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import payrollService from '../../services/payrollService';

const EditPayrollModal = ({ isOpen, onClose, payrollData, onSuccess }) => {
    const [formData, setFormData] = useState({
        baseSalary: '',
        bonuses: '',
        otherDeductions: '',
        leaveDays: '',
        notes: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (payrollData) {
            setFormData({
                baseSalary: payrollData.baseSalary || '',
                bonuses: payrollData.bonuses || 0,
                otherDeductions: payrollData.otherDeductions || 0,
                leaveDays: payrollData.leaveDays || 0,
                notes: payrollData.notes || ''
            });
        }
    }, [payrollData]);

    const calculateLeaveDeduction = () => {
        const leaveDays = parseFloat(formData.leaveDays) || 0;
        const leaveRate = payrollData?.employeeId?.leaveDeductionPerDay || 0;
        return leaveDays * leaveRate;
    };

    const calculateNetSalary = () => {
        const base = parseFloat(formData.baseSalary) || 0;
        const bonus = parseFloat(formData.bonuses) || 0;
        const deductions = parseFloat(formData.otherDeductions) || 0;
        const advanceDeductions = payrollData?.totalAdvanceDeduction || 0;
        const leaveDeduction = calculateLeaveDeduction();
        return base + bonus - deductions - advanceDeductions - leaveDeduction;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            setLoading(true);
            const leaveDays = parseFloat(formData.leaveDays) || 0;
            const leaveDeduction = calculateLeaveDeduction();

            await payrollService.updatePayrollRecord(payrollData._id, {
                baseSalary: parseFloat(formData.baseSalary),
                bonuses: parseFloat(formData.bonuses) || 0,
                otherDeductions: parseFloat(formData.otherDeductions) || 0,
                leaveDays: leaveDays,
                leaveDeduction: leaveDeduction,
                notes: formData.notes
            });
            onSuccess('Payroll record updated successfully');
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to update payroll record');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return createPortal(
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]">
            <div className="bg-white dark:bg-[#1C1C1E] rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-[#38383A]">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Edit Payroll Record</h2>
                    <p className="text-sm text-gray-600 dark:text-[#8E8E93] mt-1">
                        {payrollData?.employeeId?.name} - {monthNames[payrollData?.month - 1]} {payrollData?.year}
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6">
                    {error && (
                        <div className="mb-4 p-3 bg-red-100 dark:bg-red-500/10 border border-red-400 dark:border-red-500/30 text-red-700 dark:text-red-400 rounded">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Base Salary */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                                Base Salary <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                value={formData.baseSalary}
                                onChange={(e) => setFormData({ ...formData, baseSalary: e.target.value })}
                                min="0"
                                step="0.01"
                                required
                                className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[#1C1C1E] dark:text-white dark:placeholder-[#636366]"
                            />
                        </div>

                        {/* Bonuses */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                                Bonuses
                            </label>
                            <input
                                type="number"
                                value={formData.bonuses}
                                onChange={(e) => setFormData({ ...formData, bonuses: e.target.value })}
                                min="0"
                                step="0.01"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[#1C1C1E] dark:text-white dark:placeholder-[#636366]"
                            />
                        </div>

                        {/* Other Deductions */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                                Other Deductions
                            </label>
                            <input
                                type="number"
                                value={formData.otherDeductions}
                                onChange={(e) => setFormData({ ...formData, otherDeductions: e.target.value })}
                                min="0"
                                step="0.01"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[#1C1C1E] dark:text-white dark:placeholder-[#636366]"
                            />
                        </div>

                        {/* Leave Days */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                                Leave Days
                            </label>
                            <input
                                type="number"
                                value={formData.leaveDays}
                                onChange={(e) => setFormData({ ...formData, leaveDays: e.target.value })}
                                min="0"
                                step="1"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[#1C1C1E] dark:text-white dark:placeholder-[#636366]"
                            />
                        </div>

                        {/* Leave Deduction (Read-only) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                                Leave Deduction (Auto)
                            </label>
                            <input
                                type="number"
                                value={calculateLeaveDeduction()}
                                disabled
                                className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-md bg-gray-100 dark:bg-[#2C2C2E] dark:text-[#8E8E93] cursor-not-allowed"
                            />
                            <p className="text-xs text-gray-500 dark:text-[#636366] mt-1">
                                {formData.leaveDays || 0} days × ₹{payrollData?.employeeId?.leaveDeductionPerDay || 0}/day
                            </p>
                        </div>

                        {/* Advance Deductions (Read-only) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                                Advance Deductions (Auto)
                            </label>
                            <input
                                type="number"
                                value={payrollData?.totalAdvanceDeduction || 0}
                                disabled
                                className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-md bg-gray-100 dark:bg-[#2C2C2E] dark:text-[#8E8E93] cursor-not-allowed"
                            />
                        </div>
                    </div>

                    {/* Net Salary Display */}
                    <div className="mt-4 p-4 bg-green-50 dark:bg-emerald-500/10 border border-green-200 dark:border-emerald-500/30 rounded-md">
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-700 dark:text-white">Net Salary (Calculated):</span>
                            <span className="text-xl font-bold text-green-600 dark:text-emerald-400">
                                ₹{calculateNetSalary().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                            Notes
                        </label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows="3"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[#1C1C1E] dark:text-white dark:placeholder-[#636366]"
                            placeholder="Add any notes or comments..."
                        />
                    </div>

                    {/* Buttons */}
                    <div className="mt-6 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 dark:border-[#38383A] rounded-md text-gray-700 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={loading}
                        >
                            {loading ? 'Updating...' : 'Update Payroll'}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

EditPayrollModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    payrollData: PropTypes.object,
    onSuccess: PropTypes.func.isRequired
};

export default EditPayrollModal;
