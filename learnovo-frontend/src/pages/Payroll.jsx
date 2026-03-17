import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, Edit2, Trash2, FileText, Plus, Download, Wallet, ArrowUpRight } from 'lucide-react';
import payrollService from '../services/payrollService';
import GeneratePayrollModal from '../components/payroll/GeneratePayrollModal';
import AdvanceSalaryModal from '../components/payroll/AdvanceSalaryModal';
import PayrollDetailsModal from '../components/payroll/PayrollDetailsModal';
import EditPayrollModal from '../components/payroll/EditPayrollModal';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';

const Payroll = () => {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('payroll');

    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [showAdvanceModal, setShowAdvanceModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedPayrollId, setSelectedPayrollId] = useState(null);
    const [selectedPayroll, setSelectedPayroll] = useState(null);
    const [selectedAdvance, setSelectedAdvance] = useState(null);
    const [advanceModalMode, setAdvanceModalMode] = useState('create');

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

    const { data: payrollData, isLoading: payrollLoading } = useQuery({
        queryKey: ['payroll-records', filters],
        queryFn: async () => {
            const response = await payrollService.getPayrollRecords(filters);
            return response;
        },
        enabled: activeTab === 'payroll',
    });

    const payrollRecords = payrollData?.data || [];
    const payrollPagination = payrollData?.pagination || { current: 1, pages: 1, total: 0 };

    const { data: advanceData, isLoading: advanceLoading } = useQuery({
        queryKey: ['advance-requests', advanceFilters],
        queryFn: async () => {
            const response = await payrollService.getAdvanceRequests(advanceFilters);
            return response;
        },
        enabled: activeTab === 'advances',
    });

    const advanceRequests = advanceData?.data || [];
    const advancePagination = advanceData?.pagination || { current: 1, pages: 1, total: 0 };

    const pagination = activeTab === 'payroll' ? payrollPagination : advancePagination;
    const loading = activeTab === 'payroll' ? payrollLoading : advanceLoading;

    const deletePayrollMutation = useMutation({
        mutationFn: (id) => payrollService.deletePayrollRecord(id),
        onSuccess: () => {
            alert('Payroll record deleted successfully');
            queryClient.invalidateQueries({ queryKey: ['payroll-records'] });
        },
        onError: (err) => {
            console.error('Error deleting payroll:', err);
            alert(err.message || 'Failed to delete payroll record');
        },
    });

    const handleGenerateSuccess = (result) => {
        alert(`Payroll generated successfully! Created: ${result.data.created}, Skipped: ${result.data.skipped}`);
        queryClient.invalidateQueries({ queryKey: ['payroll-records'] });
    };

    const handleAdvanceSuccess = (message) => {
        alert(message);
        queryClient.invalidateQueries({ queryKey: ['advance-requests'] });
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
        queryClient.invalidateQueries({ queryKey: ['payroll-records'] });
    };

    const handleDeletePayroll = (id) => {
        if (window.confirm('Are you sure you want to delete this payroll record? This action cannot be undone.')) {
            deletePayrollMutation.mutate(id);
        }
    };

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const getStatusBadge = (status) => {
        const styles = {
            paid: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30',
            approved: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30',
            pending: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30',
            cancelled: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30',
            rejected: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30',
            deducted: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30',
            partial: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/30',
        };
        return (
            <span className={`px-2.5 py-1 inline-flex text-xs font-semibold rounded-lg capitalize ${styles[status] || styles.pending}`}>
                {status}
            </span>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Payroll Management</h1>
                <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">Manage employee salaries and advance payments</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-full sm:w-fit dark:bg-[#2C2C2E] overflow-x-auto">
                <button
                    onClick={() => setActiveTab('payroll')}
                    className={`px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${activeTab === 'payroll'
                        ? 'bg-white dark:bg-[#1C1C1E] text-gray-900 shadow-sm dark:text-white'
                        : 'text-gray-500 hover:text-gray-700 dark:text-[#8E8E93] dark:hover:text-white'
                    }`}
                >
                    Payroll Records
                </button>
                <button
                    onClick={() => setActiveTab('advances')}
                    className={`px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${activeTab === 'advances'
                        ? 'bg-white dark:bg-[#1C1C1E] text-gray-900 shadow-sm dark:text-white'
                        : 'text-gray-500 hover:text-gray-700 dark:text-[#8E8E93] dark:hover:text-white'
                    }`}
                >
                    Advance Salary
                </button>
            </div>

            {/* Payroll Records Tab */}
            {activeTab === 'payroll' && (
                <div className="space-y-4">
                    {/* Filters + Actions */}
                    <div className="card p-4">
                        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-between gap-4">
                            <div className="flex flex-wrap items-center gap-3">
                                <select value={filters.month} onChange={(e) => setFilters({ ...filters, month: parseInt(e.target.value), page: 1 })} className="input w-full sm:w-auto">
                                    {monthNames.map((month, index) => (
                                        <option key={index} value={index + 1}>{month}</option>
                                    ))}
                                </select>
                                <input type="number" value={filters.year} onChange={(e) => setFilters({ ...filters, year: parseInt(e.target.value), page: 1 })} min="2000" max="2100" className="input w-full sm:w-24" />
                                <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })} className="input w-full sm:w-auto">
                                    <option value="">All Status</option>
                                    <option value="pending">Pending</option>
                                    <option value="paid">Paid</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <button onClick={handleDownloadMonthlyReport} disabled={payrollRecords.length === 0} className="btn btn-outline gap-2 w-full sm:w-auto">
                                    <Download className="h-4 w-4" />
                                    Monthly Report
                                </button>
                                <button onClick={() => setShowGenerateModal(true)} className="btn btn-primary gap-2 w-full sm:w-auto">
                                    <Plus className="h-4 w-4" />
                                    Generate Payroll
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="card overflow-hidden">
                        {loading ? (
                            <LoadingSpinner />
                        ) : payrollRecords.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[700px]">
                                    <thead className="bg-gray-50/80 dark:bg-[#2C2C2E] border-b border-gray-100 dark:border-[#38383A]">
                                        <tr>
                                            <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Employee</th>
                                            <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Period</th>
                                            <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Base Salary</th>
                                            <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Deductions</th>
                                            <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Net Salary</th>
                                            <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Status</th>
                                            <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-[#38383A]">
                                        {payrollRecords.map((record) => (
                                            <tr key={record._id} className="hover:bg-gray-50/50 dark:hover:bg-[#2C2C2E]/50 transition-colors">
                                                <td className="px-5 py-3.5 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-gray-900 dark:text-white">{record.employeeId?.name}</div>
                                                    <div className="text-xs text-gray-400 dark:text-[#636366]">{record.employeeId?.employeeId}</div>
                                                </td>
                                                <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-700 dark:text-[#8E8E93]">
                                                    {monthNames[record.month - 1]} {record.year}
                                                </td>
                                                <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-700 dark:text-[#8E8E93]">
                                                    ₹{record.baseSalary?.toLocaleString('en-IN')}
                                                </td>
                                                <td className="px-5 py-3.5 whitespace-nowrap text-sm text-red-600 dark:text-red-400">
                                                    ₹{(record.otherDeductions + record.totalAdvanceDeduction)?.toLocaleString('en-IN')}
                                                </td>
                                                <td className="px-5 py-3.5 whitespace-nowrap text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                                                    ₹{record.netSalary?.toLocaleString('en-IN')}
                                                </td>
                                                <td className="px-5 py-3.5 whitespace-nowrap">
                                                    {getStatusBadge(record.paymentStatus)}
                                                </td>
                                                <td className="px-5 py-3.5 whitespace-nowrap">
                                                    <div className="flex items-center gap-1">
                                                        <button onClick={() => { setSelectedPayrollId(record._id); setShowDetailsModal(true); }} className="btn-icon" title="View Details">
                                                            <Eye className="h-4 w-4" />
                                                        </button>
                                                        <button onClick={() => { setSelectedPayroll(record); setShowEditModal(true); }} className="btn-icon" title="Edit">
                                                            <Edit2 className="h-4 w-4" />
                                                        </button>
                                                        <button onClick={() => handleDeletePayroll(record._id)} className="btn-icon hover:!text-red-500 hover:!bg-red-50 dark:hover:!bg-red-500/10" title="Delete">
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                        <button onClick={() => handleDownloadYearlyReport(record.employeeId._id)} className="btn-icon" title="Yearly Report">
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
                            <EmptyState
                                icon={Wallet}
                                title="No payroll records found for this period"
                                action={
                                    <button onClick={() => setShowGenerateModal(true)} className="btn btn-primary gap-2">
                                        <Plus className="h-4 w-4" />
                                        Generate Payroll
                                    </button>
                                }
                            />
                        )}

                        {/* Pagination */}
                        {pagination.pages > 1 && (
                            <div className="px-5 py-4 border-t border-gray-100 dark:border-[#38383A] flex items-center justify-between">
                                <div className="text-sm text-gray-500 dark:text-[#8E8E93]">
                                    Page {pagination.current} of {pagination.pages} ({pagination.total} total)
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setFilters({ ...filters, page: filters.page - 1 })} disabled={filters.page === 1} className="btn btn-sm btn-outline">Previous</button>
                                    <button onClick={() => setFilters({ ...filters, page: filters.page + 1 })} disabled={filters.page === pagination.pages} className="btn btn-sm btn-outline">Next</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Advance Salary Tab */}
            {activeTab === 'advances' && (
                <div className="space-y-4">
                    {/* Filters + Actions */}
                    <div className="card p-4">
                        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-between gap-4">
                            <div className="flex flex-wrap items-center gap-3">
                                <select value={advanceFilters.status} onChange={(e) => setAdvanceFilters({ ...advanceFilters, status: e.target.value, page: 1 })} className="input w-full sm:w-auto">
                                    <option value="">All Status</option>
                                    <option value="pending">Pending</option>
                                    <option value="approved">Approved</option>
                                    <option value="rejected">Rejected</option>
                                </select>
                                <select value={advanceFilters.deductionStatus} onChange={(e) => setAdvanceFilters({ ...advanceFilters, deductionStatus: e.target.value, page: 1 })} className="input w-full sm:w-auto">
                                    <option value="">All Deduction Status</option>
                                    <option value="pending">Pending</option>
                                    <option value="partial">Partial</option>
                                    <option value="deducted">Deducted</option>
                                </select>
                            </div>
                            <button onClick={() => { setAdvanceModalMode('create'); setShowAdvanceModal(true); }} className="btn btn-primary gap-2 w-full sm:w-auto">
                                <Plus className="h-4 w-4" />
                                New Advance Request
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="card overflow-hidden">
                        {loading ? (
                            <LoadingSpinner />
                        ) : advanceRequests.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[700px]">
                                    <thead className="bg-gray-50/80 dark:bg-[#2C2C2E] border-b border-gray-100 dark:border-[#38383A]">
                                        <tr>
                                            <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Employee</th>
                                            <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Amount</th>
                                            <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Reason</th>
                                            <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Request Date</th>
                                            <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Status</th>
                                            <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Deduction</th>
                                            <th className="px-5 py-3.5 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-[#38383A]">
                                        {advanceRequests.map((request) => (
                                            <tr key={request._id} className="hover:bg-gray-50/50 dark:hover:bg-[#2C2C2E]/50 transition-colors">
                                                <td className="px-5 py-3.5 whitespace-nowrap">
                                                    <div className="text-sm font-medium text-gray-900 dark:text-white">{request.employeeId?.name}</div>
                                                    <div className="text-xs text-gray-400 dark:text-[#636366]">{request.employeeId?.employeeId}</div>
                                                </td>
                                                <td className="px-5 py-3.5 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
                                                    ₹{request.amount?.toLocaleString('en-IN')}
                                                </td>
                                                <td className="px-5 py-3.5 text-sm text-gray-700 dark:text-[#8E8E93] max-w-[200px] truncate">
                                                    {request.reason}
                                                </td>
                                                <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-500 dark:text-[#8E8E93]">
                                                    {new Date(request.requestDate).toLocaleDateString('en-IN')}
                                                </td>
                                                <td className="px-5 py-3.5 whitespace-nowrap">{getStatusBadge(request.status)}</td>
                                                <td className="px-5 py-3.5 whitespace-nowrap">
                                                    {request.status === 'approved' && getStatusBadge(request.deductionStatus)}
                                                </td>
                                                <td className="px-5 py-3.5 whitespace-nowrap">
                                                    <button
                                                        onClick={() => { setSelectedAdvance(request); setAdvanceModalMode('view'); setShowAdvanceModal(true); }}
                                                        className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
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
                            <EmptyState icon={ArrowUpRight} title="No advance requests found" />
                        )}

                        {pagination.pages > 1 && (
                            <div className="px-5 py-4 border-t border-gray-100 dark:border-[#38383A] flex items-center justify-between">
                                <div className="text-sm text-gray-500 dark:text-[#8E8E93]">
                                    Page {pagination.current} of {pagination.pages} ({pagination.total} total)
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setAdvanceFilters({ ...advanceFilters, page: advanceFilters.page - 1 })} disabled={advanceFilters.page === 1} className="btn btn-sm btn-outline">Previous</button>
                                    <button onClick={() => setAdvanceFilters({ ...advanceFilters, page: advanceFilters.page + 1 })} disabled={advanceFilters.page === pagination.pages} className="btn btn-sm btn-outline">Next</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modals */}
            <GeneratePayrollModal isOpen={showGenerateModal} onClose={() => setShowGenerateModal(false)} onSuccess={handleGenerateSuccess} />
            <AdvanceSalaryModal isOpen={showAdvanceModal} onClose={() => { setShowAdvanceModal(false); setSelectedAdvance(null); }} onSuccess={handleAdvanceSuccess} mode={advanceModalMode} advanceData={selectedAdvance} />
            <PayrollDetailsModal isOpen={showDetailsModal} onClose={() => { setShowDetailsModal(false); setSelectedPayrollId(null); }} payrollId={selectedPayrollId} />
            <EditPayrollModal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setSelectedPayroll(null); }} payrollData={selectedPayroll} onSuccess={handleEditSuccess} />
        </div>
    );
};

export default Payroll;
