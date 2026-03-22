import { useState, useEffect } from 'react';
import payrollService from '../../services/payrollService';
import employeesService from '../../services/employeesService';

const GeneratePayrollModal = ({ isOpen, onClose, onSuccess }) => {
    const currentDate = new Date();
    const [formData, setFormData] = useState({
        month: currentDate.getMonth() + 1,
        year: currentDate.getFullYear(),
        overwrite: false
    });
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            fetchEmployees();
        }
    }, [isOpen]);

    const fetchEmployees = async () => {
        try {
            setPreviewLoading(true);
            setError(''); // Clear any previous errors
            const response = await employeesService.list({ limit: 100, status: 'active' });
            const employeesWithSalary = (response.data || []).filter(emp => emp.salary && emp.salary > 0);
            setEmployees(employeesWithSalary);
        } catch (err) {
            setError('Failed to fetch employees: ' + (err.message || 'Unknown error'));
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const result = await payrollService.generateMonthlyPayroll(formData);
            onSuccess(result);
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to generate payroll');
        } finally {
            setLoading(false);
        }
    };

    const totalSalary = employees.reduce((sum, emp) => sum + (emp.salary || 0), 0);

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]">
            <div className="bg-white dark:bg-[#1C1C1E] rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200 dark:border-[#38383A]">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Generate Monthly Payroll</h2>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    {error && (
                        <div className="mb-4 p-3 bg-red-100 dark:bg-red-500/10 border border-red-400 dark:border-red-500/30 text-red-700 dark:text-red-400 rounded">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-2">
                                Month
                            </label>
                            <select
                                value={formData.month}
                                onChange={(e) => setFormData({ ...formData, month: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[#1C1C1E] dark:text-white"
                                required
                            >
                                {monthNames.map((month, index) => (
                                    <option key={index} value={index + 1}>{month}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-2">
                                Year
                            </label>
                            <input
                                type="number"
                                value={formData.year}
                                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                                min="2000"
                                max="2100"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[#1C1C1E] dark:text-white dark:placeholder-[#636366]"
                                required
                            />
                        </div>
                    </div>

                    <div className="mb-6">
                        <label className="flex items-center">
                            <input
                                type="checkbox"
                                checked={formData.overwrite}
                                onChange={(e) => setFormData({ ...formData, overwrite: e.target.checked })}
                                className="mr-2 dark:bg-[#1C1C1E] dark:border-[#38383A]"
                            />
                            <span className="text-sm text-gray-700 dark:text-white">
                                Overwrite existing payroll records for this period
                            </span>
                        </label>
                    </div>

                    <div className="bg-gray-50 dark:bg-[#2C2C2E] p-4 rounded-lg mb-6">
                        <h3 className="font-semibold text-gray-800 dark:text-white mb-3">Preview</h3>

                        {previewLoading ? (
                            <p className="text-gray-600 dark:text-[#8E8E93]">Loading employees...</p>
                        ) : (
                            <>
                                <div className="grid grid-cols-2 gap-4 mb-3">
                                    <div>
                                        <p className="text-sm text-gray-600 dark:text-[#8E8E93]">Total Employees</p>
                                        <p className="text-2xl font-bold text-gray-800 dark:text-white">{employees.length}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600 dark:text-[#8E8E93]">Total Salary Amount</p>
                                        <p className="text-2xl font-bold text-green-600 dark:text-emerald-400">₹{totalSalary.toLocaleString('en-IN')}</p>
                                    </div>
                                </div>

                                {employees.length > 0 && (
                                    <div className="max-h-40 overflow-y-auto">
                                        <p className="text-xs text-gray-500 dark:text-[#636366] mb-2">Employees to be included:</p>
                                        <ul className="text-sm text-gray-700 dark:text-[#8E8E93] space-y-1">
                                            {employees.slice(0, 10).map(emp => (
                                                <li key={emp._id} className="flex justify-between">
                                                    <span>{emp.name} ({emp.employeeId})</span>
                                                    <span className="font-semibold dark:text-white">₹{emp.salary?.toLocaleString('en-IN')}</span>
                                                </li>
                                            ))}
                                            {employees.length > 10 && (
                                                <li className="text-gray-500 dark:text-[#636366] italic">...and {employees.length - 10} more</li>
                                            )}
                                        </ul>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 dark:text-[#8E8E93] bg-gray-200 dark:bg-[#2C2C2E] rounded-md hover:bg-gray-300 dark:hover:bg-[#38383A] transition"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:bg-gray-400 dark:disabled:bg-[#38383A]"
                            disabled={loading || employees.length === 0}
                        >
                            {loading ? 'Generating...' : 'Generate Payroll'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default GeneratePayrollModal;
