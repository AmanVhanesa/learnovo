import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import payrollService from '../../services/payrollService';

const PayrollDetailsModal = ({ isOpen, onClose, payrollId }) => {
    const [payroll, setPayroll] = useState(null);
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        if (isOpen && payrollId) {
            fetchPayrollDetails();
        }
    }, [isOpen, payrollId]);

    const fetchPayrollDetails = async () => {
        try {
            setLoading(true);
            const response = await payrollService.getPayrollRecord(payrollId);
            setPayroll(response.data);
        } catch (err) {
            toast.error('Failed to load payroll details');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadSlip = async () => {
        try {
            setDownloading(true);
            const blob = await payrollService.downloadSalarySlip(payrollId);

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `salary_slip_${payroll.month}_${payroll.year}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            toast.error('Failed to download salary slip');
        } finally {
            setDownloading(false);
        }
    };

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]">
            <div className="bg-white dark:bg-[#1C1C1E] rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200 dark:border-[#38383A]">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Payroll Details</h2>
                </div>

                <div className="p-6">
                    {loading ? (
                        <div className="text-center py-8">
                            <p className="text-gray-600 dark:text-[#8E8E93]">Loading...</p>
                        </div>
                    ) : payroll ? (
                        <div className="space-y-6">
                            {/* Employee Info */}
                            <div className="bg-gray-50 dark:bg-[#2C2C2E] p-4 rounded-lg">
                                <h3 className="font-semibold text-gray-800 dark:text-white mb-3">Employee Information</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <p className="text-sm text-gray-600 dark:text-[#8E8E93]">Name</p>
                                        <p className="font-semibold dark:text-white">{payroll.employeeId?.name}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600 dark:text-[#8E8E93]">Employee ID</p>
                                        <p className="font-semibold dark:text-white">{payroll.employeeId?.employeeId}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600 dark:text-[#8E8E93]">Designation</p>
                                        <p className="font-semibold dark:text-white">{payroll.employeeId?.designation || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600 dark:text-[#8E8E93]">Department</p>
                                        <p className="font-semibold dark:text-white">{payroll.employeeId?.department || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Period */}
                            <div>
                                <p className="text-sm text-gray-600 dark:text-[#8E8E93]">Period</p>
                                <p className="text-xl font-bold text-gray-800 dark:text-white">
                                    {monthNames[payroll.month - 1]} {payroll.year}
                                </p>
                            </div>

                            {/* Salary Breakdown */}
                            <div className="bg-blue-50 dark:bg-blue-500/10 p-4 rounded-lg">
                                <h3 className="font-semibold text-gray-800 dark:text-white mb-3">Salary Breakdown</h3>

                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-gray-700 dark:text-[#8E8E93]">Base Salary</span>
                                        <span className="font-semibold dark:text-white">₹{payroll.baseSalary?.toLocaleString('en-IN')}</span>
                                    </div>

                                    {payroll.bonuses > 0 && (
                                        <div className="flex justify-between text-green-600 dark:text-emerald-400">
                                            <span>Bonuses</span>
                                            <span className="font-semibold">+₹{payroll.bonuses?.toLocaleString('en-IN')}</span>
                                        </div>
                                    )}

                                    {payroll.otherDeductions > 0 && (
                                        <div className="flex justify-between text-red-600 dark:text-red-400">
                                            <span>Other Deductions</span>
                                            <span className="font-semibold">-₹{payroll.otherDeductions?.toLocaleString('en-IN')}</span>
                                        </div>
                                    )}

                                    {(payroll.leaveDays > 0 || payroll.leaveDeduction > 0) && (
                                        <div className="flex justify-between text-red-600 dark:text-red-400">
                                            <span>Leave Deduction ({payroll.leaveDays || 0} days)</span>
                                            <span className="font-semibold">-₹{payroll.leaveDeduction?.toLocaleString('en-IN')}</span>
                                        </div>
                                    )}

                                    {payroll.advanceDeductions && payroll.advanceDeductions.length > 0 && (
                                        <div className="border-t border-gray-200 dark:border-[#38383A] pt-2 mt-2">
                                            <p className="text-sm font-semibold text-gray-700 dark:text-[#8E8E93] mb-2">Advance Salary Deductions:</p>
                                            {payroll.advanceDeductions.map((adv, index) => (
                                                <div key={index} className="flex justify-between text-sm text-red-600 dark:text-red-400 ml-4">
                                                    <span>• {adv.advanceId?.reason || 'Advance'}</span>
                                                    <span className="font-semibold">-₹{adv.amount?.toLocaleString('en-IN')}</span>
                                                </div>
                                            ))}
                                            <div className="flex justify-between text-red-600 dark:text-red-400 font-semibold mt-1">
                                                <span>Total Advance Deduction</span>
                                                <span>-₹{payroll.totalAdvanceDeduction?.toLocaleString('en-IN')}</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="border-t-2 border-gray-300 dark:border-[#38383A] pt-2 mt-2">
                                        <div className="flex justify-between text-lg font-bold text-gray-800 dark:text-white">
                                            <span>Net Salary</span>
                                            <span className="text-green-600 dark:text-emerald-400">₹{payroll.netSalary?.toLocaleString('en-IN')}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Payment Status */}
                            <div>
                                <p className="text-sm text-gray-600 dark:text-[#8E8E93] mb-2">Payment Status</p>
                                <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${payroll.paymentStatus === 'paid' ? 'bg-green-100 text-green-800 dark:bg-emerald-500/10 dark:text-emerald-400' :
                                    payroll.paymentStatus === 'cancelled' ? 'bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-400' :
                                        'bg-yellow-100 text-yellow-800 dark:bg-amber-500/10 dark:text-amber-400'
                                    }`}>
                                    {payroll.paymentStatus?.toUpperCase()}
                                </span>

                                {payroll.paymentDate && (
                                    <p className="text-sm text-gray-600 dark:text-[#8E8E93] mt-2">
                                        Payment Date: {new Date(payroll.paymentDate).toLocaleDateString('en-IN')}
                                    </p>
                                )}
                            </div>

                            {payroll.notes && (
                                <div>
                                    <p className="text-sm text-gray-600 dark:text-[#8E8E93]">Notes</p>
                                    <p className="text-gray-700 dark:text-white">{payroll.notes}</p>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-[#38383A]">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 text-gray-700 dark:text-[#8E8E93] bg-gray-200 dark:bg-[#2C2C2E] rounded-md hover:bg-gray-300 dark:hover:bg-[#38383A] transition"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={handleDownloadSlip}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:bg-gray-400 dark:disabled:bg-[#38383A] flex items-center gap-2"
                                    disabled={downloading}
                                >
                                    {downloading ? (
                                        'Downloading...'
                                    ) : (
                                        <>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            Download Salary Slip
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <p className="text-gray-600 dark:text-[#8E8E93]">No payroll data found</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PayrollDetailsModal;
