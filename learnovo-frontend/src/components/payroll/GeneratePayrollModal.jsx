import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const [search, setSearch] = useState('');
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
            setError('');
            const response = await employeesService.list({ limit: 100, status: 'active' });
            const employeesWithSalary = (response.data || []).filter(emp => emp.salary && emp.salary > 0);
            setEmployees(employeesWithSalary);
            setSelectedIds(new Set(employeesWithSalary.map(e => e._id)));
        } catch (err) {
            setError('Failed to fetch employees: ' + (err.message || 'Unknown error'));
        } finally {
            setPreviewLoading(false);
        }
    };

    const toggleOne = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const filteredEmployees = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return employees;
        return employees.filter(e =>
            (e.name || '').toLowerCase().includes(q) ||
            (e.employeeId || '').toLowerCase().includes(q)
        );
    }, [employees, search]);

    const allFilteredSelected = filteredEmployees.length > 0 &&
        filteredEmployees.every(e => selectedIds.has(e._id));

    const toggleAllFiltered = () => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (allFilteredSelected) {
                filteredEmployees.forEach(e => next.delete(e._id));
            } else {
                filteredEmployees.forEach(e => next.add(e._id));
            }
            return next;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (selectedIds.size === 0) {
            setError('Select at least one employee to generate payroll for');
            return;
        }

        setLoading(true);
        try {
            const result = await payrollService.generateMonthlyPayroll({
                ...formData,
                employeeIds: Array.from(selectedIds)
            });
            onSuccess(result);
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to generate payroll');
        } finally {
            setLoading(false);
        }
    };

    const selectedEmployees = employees.filter(e => selectedIds.has(e._id));
    const totalSalary = selectedEmployees.reduce((sum, emp) => sum + (emp.salary || 0), 0);

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    if (!isOpen) return null;

    return createPortal(
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
                                        <p className="text-sm text-gray-600 dark:text-[#8E8E93]">Selected Employees</p>
                                        <p className="text-2xl font-bold text-gray-800 dark:text-white">
                                            {selectedEmployees.length}
                                            <span className="text-base font-medium text-gray-500 dark:text-[#636366]"> / {employees.length}</span>
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600 dark:text-[#8E8E93]">Total Salary Amount</p>
                                        <p className="text-2xl font-bold text-green-600 dark:text-emerald-400">₹{totalSalary.toLocaleString('en-IN')}</p>
                                    </div>
                                </div>

                                {employees.length > 0 && (
                                    <div>
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <p className="text-xs text-gray-500 dark:text-[#636366]">
                                                Tick the employees to include
                                            </p>
                                            <button
                                                type="button"
                                                onClick={toggleAllFiltered}
                                                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                                            >
                                                {allFilteredSelected ? 'Deselect all' : 'Select all'}
                                            </button>
                                        </div>

                                        <input
                                            type="text"
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            placeholder="Search employee by name or ID..."
                                            className="w-full mb-2 px-3 py-2 text-sm border border-gray-300 dark:border-[#38383A] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[#1C1C1E] dark:text-white dark:placeholder-[#636366]"
                                        />

                                        <div className="max-h-64 overflow-y-auto pr-1 border border-gray-200 dark:border-[#38383A] rounded-md">
                                            <ul className="divide-y divide-gray-100 dark:divide-[#38383A]">
                                                {filteredEmployees.length === 0 ? (
                                                    <li className="px-3 py-4 text-sm text-center text-gray-500 dark:text-[#636366]">
                                                        No employees match your search
                                                    </li>
                                                ) : filteredEmployees.map(emp => {
                                                    const checked = selectedIds.has(emp._id);
                                                    return (
                                                        <li key={emp._id}>
                                                            <label className="flex items-center justify-between gap-3 px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-[#38383A] transition">
                                                                <div className="flex items-center gap-3 min-w-0">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={checked}
                                                                        onChange={() => toggleOne(emp._id)}
                                                                        className="h-4 w-4 rounded border-gray-300 dark:border-[#38383A] text-blue-600 focus:ring-blue-500"
                                                                    />
                                                                    <span className={`text-sm truncate ${checked ? 'text-gray-800 dark:text-white' : 'text-gray-500 dark:text-[#8E8E93]'}`}>
                                                                        {emp.name} <span className="text-gray-400 dark:text-[#636366]">({emp.employeeId})</span>
                                                                    </span>
                                                                </div>
                                                                <span className={`font-semibold whitespace-nowrap text-sm ${checked ? 'text-gray-800 dark:text-white' : 'text-gray-400 dark:text-[#636366] line-through'}`}>
                                                                    ₹{emp.salary?.toLocaleString('en-IN')}
                                                                </span>
                                                            </label>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>
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
                            disabled={loading || selectedEmployees.length === 0}
                        >
                            {loading ? 'Generating...' : `Generate Payroll${selectedEmployees.length ? ` (${selectedEmployees.length})` : ''}`}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default GeneratePayrollModal;
