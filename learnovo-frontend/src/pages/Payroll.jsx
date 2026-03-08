import { useState, useEffect } from 'react';
import { Eye, Edit2, Trash2, FileText } from 'lucide-react';
import payrollService from '../services/payrollService';
import GeneratePayrollModal from '../components/payroll/GeneratePayrollModal';
import AdvanceSalaryModal from '../components/payroll/AdvanceSalaryModal';
import PayrollDetailsModal from '../components/payroll/PayrollDetailsModal';
import EditPayrollModal from '../components/payroll/EditPayrollModal';

const Payroll = () => {
    const [activeTab, setActiveTab] = useState('payroll');
    const [payrollRecords, setPayrollRecords] = useState([]);
    const [advanceRequests, setAdvanceRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({ current: 1, pages: 1, total: 0 });

    // Modals
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [showAdvanceModal, setShowAdvanceModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedPayrollId, setSelectedPayrollId] = useState(null);
    const [selectedPayroll, setSelectedPayroll] = useState(null);
    const [selectedAdvance, setSelectedAdvance] = useState(null);
    const [advanceModalMode, setAdvanceModalMode] = useState('create');

    // Filters
    const currentDate = new Date();
    const [filters, setFilters] = useState({
        month: currentDate.getMonth() + 1,
        year: currentDate.getFullYear(),
        status: '',
        page: 1
    });

    const [advanceFilters, setAdvanceFilters] = useState({
        status: '',
        deductionStatus: '',
        page: 1
    });

    useEffect(() => {
        if (activeTab === 'payroll') {
            fetchPayrollRecords();
        } else if (activeTab === 'advances') {
            fetchAdvanceRequests();
        }
    }, [activeTab, filters, advanceFilters]);

    const fetchPayrollRecords = async () => {
        try {
            setLoading(true);
            const response = await payrollService.getPayrollRecords(filters);
            setPayrollRecords(response.data);
            setPagination(response.pagination);
        } catch (err) {
            console.error('Error fetching payroll records:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchAdvanceRequests = async () => {
        try {
            setLoading(true);
            const response = await payrollService.getAdvanceRequests(advanceFilters);
            setAdvanceRequests(response.data);
            setPagination(response.pagination);
        } catch (err) {
            console.error('Error fetching advance requests:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateSuccess = (result) => {
        alert(`Payroll generated successfully! Created: ${result.data.created}, Skipped: ${result.data.skipped}`);
        fetchPayrollRecords();
    };

    const handleAdvanceSuccess = (message) => {
        alert(message);
        fetchAdvanceRequests();
    };

    const handleDownloadMonthlyReport = async () => {
        try {
            const blob = await payrollService.downloadMonthlyReport(filters.year, filters.month);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `monthly_salary_report_${filters.month}_${filters.year}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Error downloading monthly report:', err);
            alert('Failed to download monthly report');
        }
    };

    const handleDownloadYearlyReport = async (employeeId) => {
        try {
            const blob = await payrollService.downloadYearlyReport(employeeId, filters.year);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `yearly_salary_report_${filters.year}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Error downloading yearly report:', err);
            alert('Failed to download yearly report');
        }
    };

    const handleEditSuccess = (message) => {
        alert(message);
        fetchPayrollRecords();
    };

    const handleDeletePayroll = async (id) => {
        if (window.confirm('Are you sure you want to delete this payroll record? This action cannot be undone.')) {
            try {
                await payrollService.deletePayrollRecord(id);
                alert('Payroll record deleted successfully');
                fetchPayrollRecords();
            } catch (err) {
                console.error('Error deleting payroll:', err);
                alert(err.message || 'Failed to delete payroll record');
            }
        }
    };

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">Payroll Management</h1>
                <p className="text-gray-600">Manage employee salaries and advance payments</p>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 mb-6">
                <nav className="flex gap-4">
                    <button
                        onClick={() => setActiveTab('payroll')}
                        className={`pb-3 px-2 font-semibold transition ${activeTab === 'payroll'
                            ? 'border-b-2 border-blue-600 text-blue-600'
                            : 'text-gray-600 hover:text-gray-800'
                            }`}
                    >
                        Payroll Records
                    </button>
                    <button
                        onClick={() => setActiveTab('advances')}
                        className={`pb-3 px-2 font-semibold transition ${activeTab === 'advances'
                            ? 'border-b-2 border-blue-600 text-blue-600'
                            : 'text-gray-600 hover:text-gray-800'
                            }`}
                    >
                        Advance Salary
                    </button>
                </nav>
            </div>

            {/* Payroll Records Tab */}
            {activeTab === 'payroll' && (
                <div>
                    {/* Actions and Filters */}
                    <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex flex-wrap items-center gap-3">
                                <select
                                    value={filters.month}
                                    onChange={(e) => setFilters({ ...filters, month: parseInt(e.target.value), page: 1 })}
                                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {monthNames.map((month, index) => (
                                        <option key={index} value={index + 1}>{month}</option>
                                    ))}
                                </select>

                                <input
                                    type="number"
                                    value={filters.year}
                                    onChange={(e) => setFilters({ ...filters, year: parseInt(e.target.value), page: 1 })}
                                    min="2000"
                                    max="2100"
                                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-24"
                                />

                                <select
                                    value={filters.status}
                                    onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
                                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">All Status</option>
                                    <option value="pending">Pending</option>
                                    <option value="paid">Paid</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={handleDownloadMonthlyReport}
                                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition flex items-center gap-2"
                                    disabled={payrollRecords.length === 0}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    Monthly Report
                                </button>

                                <button
                                    onClick={() => setShowGenerateModal(true)}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition flex items-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Generate Payroll
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Payroll Records Table */}
                    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                        {loading ? (
                            <div className="text-center py-12">
                                <p className="text-gray-600">Loading payroll records...</p>
                            </div>
                        ) : payrollRecords.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Employee
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Period
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Base Salary
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Deductions
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Net Salary
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Status
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {payrollRecords.map((record) => (
                                            <tr key={record._id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {record.employeeId?.name}
                                                        </div>
                                                        <div className="text-sm text-gray-500">
                                                            {record.employeeId?.employeeId}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {monthNames[record.month - 1]} {record.year}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    ₹{record.baseSalary?.toLocaleString('en-IN')}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                                                    ₹{(record.otherDeductions + record.totalAdvanceDeduction)?.toLocaleString('en-IN')}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                                                    ₹{record.netSalary?.toLocaleString('en-IN')}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${record.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' :
                                                        record.paymentStatus === 'cancelled' ? 'bg-red-100 text-red-800' :
                                                            'bg-yellow-100 text-yellow-800'
                                                        }`}>
                                                        {record.paymentStatus}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                    <div className="flex space-x-2">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedPayrollId(record._id);
                                                                setShowDetailsModal(true);
                                                            }}
                                                            className="p-1 text-gray-400 hover:text-blue-600"
                                                            title="View Details"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setSelectedPayroll(record);
                                                                setShowEditModal(true);
                                                            }}
                                                            className="p-1 text-gray-400 hover:text-purple-600"
                                                            title="Edit Payroll"
                                                        >
                                                            <Edit2 className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeletePayroll(record._id)}
                                                            className="p-1 text-gray-400 hover:text-red-600"
                                                            title="Delete Payroll"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDownloadYearlyReport(record.employeeId._id)}
                                                            className="p-1 text-gray-400 hover:text-green-600"
                                                            title="Download Yearly Report"
                                                        >
                                                            <FileText className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <p className="text-gray-600">No payroll records found for this period</p>
                                <button
                                    onClick={() => setShowGenerateModal(true)}
                                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                                >
                                    Generate Payroll
                                </button>
                            </div>
                        )}

                        {/* Pagination */}
                        {pagination.pages > 1 && (
                            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                                <div className="text-sm text-gray-700">
                                    Page {pagination.current} of {pagination.pages} ({pagination.total} total)
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                                        disabled={filters.page === 1}
                                        className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Previous
                                    </button>
                                    <button
                                        onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                                        disabled={filters.page === pagination.pages}
                                        className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Advance Salary Tab */}
            {activeTab === 'advances' && (
                <div>
                    {/* Actions and Filters */}
                    <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex flex-wrap items-center gap-3">
                                <select
                                    value={advanceFilters.status}
                                    onChange={(e) => setAdvanceFilters({ ...advanceFilters, status: e.target.value, page: 1 })}
                                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">All Status</option>
                                    <option value="pending">Pending</option>
                                    <option value="approved">Approved</option>
                                    <option value="rejected">Rejected</option>
                                </select>

                                <select
                                    value={advanceFilters.deductionStatus}
                                    onChange={(e) => setAdvanceFilters({ ...advanceFilters, deductionStatus: e.target.value, page: 1 })}
                                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">All Deduction Status</option>
                                    <option value="pending">Pending</option>
                                    <option value="partial">Partial</option>
                                    <option value="deducted">Deducted</option>
                                </select>
                            </div>

                            <button
                                onClick={() => {
                                    setAdvanceModalMode('create');
                                    setShowAdvanceModal(true);
                                }}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition flex items-center gap-2"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                New Advance Request
                            </button>
                        </div>
                    </div>

                    {/* Advance Requests Table */}
                    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                        {loading ? (
                            <div className="text-center py-12">
                                <p className="text-gray-600">Loading advance requests...</p>
                            </div>
                        ) : advanceRequests.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Employee
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Amount
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Reason
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Request Date
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Status
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Deduction
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {advanceRequests.map((request) => (
                                            <tr key={request._id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900">
                                                            {request.employeeId?.name}
                                                        </div>
                                                        <div className="text-sm text-gray-500">
                                                            {request.employeeId?.employeeId}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                                    ₹{request.amount?.toLocaleString('en-IN')}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-900">
                                                    {request.reason}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {new Date(request.requestDate).toLocaleDateString('en-IN')}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${request.status === 'approved' ? 'bg-green-100 text-green-800' :
                                                        request.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                                            'bg-yellow-100 text-yellow-800'
                                                        }`}>
                                                        {request.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {request.status === 'approved' && (
                                                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${request.deductionStatus === 'deducted' ? 'bg-green-100 text-green-800' :
                                                            request.deductionStatus === 'partial' ? 'bg-blue-100 text-blue-800' :
                                                                'bg-yellow-100 text-yellow-800'
                                                            }`}>
                                                            {request.deductionStatus}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedAdvance(request);
                                                            setAdvanceModalMode('view');
                                                            setShowAdvanceModal(true);
                                                        }}
                                                        className="text-blue-600 hover:text-blue-800 font-medium"
                                                    >
                                                        {request.status === 'pending' ? 'Review' : 'View'}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <p className="text-gray-600">No advance requests found</p>
                            </div>
                        )}

                        {/* Pagination */}
                        {pagination.pages > 1 && (
                            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                                <div className="text-sm text-gray-700">
                                    Page {pagination.current} of {pagination.pages} ({pagination.total} total)
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setAdvanceFilters({ ...advanceFilters, page: advanceFilters.page - 1 })}
                                        disabled={advanceFilters.page === 1}
                                        className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Previous
                                    </button>
                                    <button
                                        onClick={() => setAdvanceFilters({ ...advanceFilters, page: advanceFilters.page + 1 })}
                                        disabled={advanceFilters.page === pagination.pages}
                                        className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modals */}
            <GeneratePayrollModal
                isOpen={showGenerateModal}
                onClose={() => setShowGenerateModal(false)}
                onSuccess={handleGenerateSuccess}
            />

            <AdvanceSalaryModal
                isOpen={showAdvanceModal}
                onClose={() => {
                    setShowAdvanceModal(false);
                    setSelectedAdvance(null);
                }}
                onSuccess={handleAdvanceSuccess}
                mode={advanceModalMode}
                advanceData={selectedAdvance}
            />

            <PayrollDetailsModal
                isOpen={showDetailsModal}
                onClose={() => {
                    setShowDetailsModal(false);
                    setSelectedPayrollId(null);
                }}
                payrollId={selectedPayrollId}
            />

            <EditPayrollModal
                isOpen={showEditModal}
                onClose={() => {
                    setShowEditModal(false);
                    setSelectedPayroll(null);
                }}
                payrollData={selectedPayroll}
                onSuccess={handleEditSuccess}
            />
        </div>
    );
};

export default Payroll;
