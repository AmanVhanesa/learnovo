import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Eye, Edit2, Trash2, FileText, Plus, Download, Wallet, ArrowUpRight,
    IndianRupee, Users, CheckCircle, Clock, ChevronDown, FileSpreadsheet,
    Building2, Search, AlertTriangle, RefreshCw, Calendar
} from 'lucide-react';
import toast from 'react-hot-toast';
import payrollService from '../services/payrollService';
import { academicSessionsService } from '../services/academicsService';
import { exportReport } from '../utils/exportHelpers';
import { formatCurrency } from '../utils/formatCurrency';
import { useSettings } from '../contexts/SettingsContext';
import ExportColumnPicker from '../components/ExportColumnPicker';
import GeneratePayrollModal from '../components/payroll/GeneratePayrollModal';
import AdvanceSalaryModal from '../components/payroll/AdvanceSalaryModal';
import PayrollDetailsModal from '../components/payroll/PayrollDetailsModal';
import EditPayrollModal from '../components/payroll/EditPayrollModal';
import AcademicSessionSelector from '../components/AcademicSessionSelector';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import KpiCard from '../components/KpiCard';

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const Payroll = () => {
    const { settings } = useSettings();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('payroll');
    const [searchTerm, setSearchTerm] = useState('');

    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [showAdvanceModal, setShowAdvanceModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedPayrollId, setSelectedPayrollId] = useState(null);
    const [selectedPayroll, setSelectedPayroll] = useState(null);
    const [selectedAdvance, setSelectedAdvance] = useState(null);
    const [advanceModalMode, setAdvanceModalMode] = useState('create');
    const [showExportMenu, setShowExportMenu] = useState(false);
    const exportMenuRef = useRef(null);
    const [showCustomExportModal, setShowCustomExportModal] = useState(false);
    const [showIciciModal, setShowIciciModal] = useState(false);
    const [iciciLoading, setIciciLoading] = useState(false);
    const [iciciForm, setIciciForm] = useState({
        debitAccountNo: '',
        paymentMode: 'NEFT',
        paymentDate: ''
    });

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

    // Close export menu on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
                setShowExportMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // ─── Active Session ────────────────────────────────────────
    const [selectedSession, setSelectedSession] = useState(null);

    const { data: activeSession, isLoading: sessionLoading } = useQuery({
        queryKey: ['payroll-active-session'],
        queryFn: async () => { const res = await academicSessionsService.getActive(); return res.data },
    });

    const currentSession = selectedSession || activeSession;

    // ─── Queries ──────────────────────────────────────────────
    const { data: payrollData, isLoading: payrollLoading, isRefetching: payrollRefetching, error: payrollError, refetch: refetchPayroll } = useQuery({
        queryKey: ['payroll-records', filters, currentSession?._id],
        queryFn: () => payrollService.getPayrollRecords({ ...filters, academicSessionId: currentSession?._id }),
        enabled: !!currentSession && activeTab === 'payroll',
    });

    const payrollRecords = payrollData?.data || [];
    const payrollPagination = payrollData?.pagination || { current: 1, pages: 1, total: 0 };

    const { data: summaryData } = useQuery({
        queryKey: ['payroll-summary', filters.year, filters.month],
        queryFn: async () => {
            try {
                const response = await payrollService.getSalarySummary(filters.year, filters.month);
                return response.data || response;
            } catch {
                return null;
            }
        },
        enabled: activeTab === 'payroll',
    });

    const { data: advanceData, isLoading: advanceLoading } = useQuery({
        queryKey: ['advance-requests', advanceFilters],
        queryFn: () => payrollService.getAdvanceRequests(advanceFilters),
        enabled: activeTab === 'advances',
    });

    const advanceRequests = advanceData?.data || [];
    const advancePagination = advanceData?.pagination || { current: 1, pages: 1, total: 0 };

    const pagination = activeTab === 'payroll' ? payrollPagination : advancePagination;
    const loading = activeTab === 'payroll' ? payrollLoading : advanceLoading;

    // ─── Mutations ────────────────────────────────────────────
    const deletePayrollMutation = useMutation({
        mutationFn: (id) => payrollService.deletePayrollRecord(id),
        onSuccess: () => {
            toast.success('Payroll record deleted successfully');
            queryClient.invalidateQueries({ queryKey: ['payroll-records'] });
            queryClient.invalidateQueries({ queryKey: ['payroll-summary'] });
        },
        onError: (err) => toast.error(err.message || 'Failed to delete payroll record'),
    });

    const markAsPaidMutation = useMutation({
        mutationFn: (id) => payrollService.markAsPaid(id),
        onSuccess: () => {
            toast.success('Payroll marked as paid');
            queryClient.invalidateQueries({ queryKey: ['payroll-records'] });
            queryClient.invalidateQueries({ queryKey: ['payroll-summary'] });
        },
        onError: (err) => toast.error(err.message || 'Failed to update payment status'),
    });

    const bulkMarkAsPaidMutation = useMutation({
        mutationFn: (ids) => payrollService.bulkMarkAsPaid(ids),
        onSuccess: (_, ids) => {
            toast.success(`${ids.length} payroll record${ids.length > 1 ? 's' : ''} marked as paid`);
            queryClient.invalidateQueries({ queryKey: ['payroll-records'] });
            queryClient.invalidateQueries({ queryKey: ['payroll-summary'] });
        },
        onError: (err) => toast.error(err.message || 'Failed to bulk update payment status'),
    });

    // ─── Handlers ─────────────────────────────────────────────
    const handleGenerateSuccess = (result) => {
        toast.success(`Payroll generated! Created: ${result.data.created}, Skipped: ${result.data.skipped}`);
        queryClient.invalidateQueries({ queryKey: ['payroll-records'] });
        queryClient.invalidateQueries({ queryKey: ['payroll-summary'] });
    };

    const handleAdvanceSuccess = (message) => {
        toast.success(message);
        queryClient.invalidateQueries({ queryKey: ['advance-requests'] });
    };

    const handleEditSuccess = (message) => {
        toast.success(message);
        queryClient.invalidateQueries({ queryKey: ['payroll-records'] });
        queryClient.invalidateQueries({ queryKey: ['payroll-summary'] });
    };

    const handleDeletePayroll = (id) => {
        if (window.confirm('Are you sure you want to delete this payroll record? This action cannot be undone.')) {
            deletePayrollMutation.mutate(id);
        }
    };

    const handleMarkAsPaid = (id) => {
        if (window.confirm('Mark this payroll as paid?')) {
            markAsPaidMutation.mutate(id);
        }
    };

    const handleBulkMarkAsPaid = () => {
        const pendingIds = payrollRecords
            .filter(r => r.paymentStatus === 'pending')
            .map(r => r._id);
        if (pendingIds.length === 0) {
            toast.error('No pending payroll records to mark as paid');
            return;
        }
        if (window.confirm(`Mark all ${pendingIds.length} pending payroll record${pendingIds.length > 1 ? 's' : ''} as paid?`)) {
            bulkMarkAsPaidMutation.mutate(pendingIds);
        }
    };

    // ─── PDF Monthly Report ──────────────────────────────────
    const handleDownloadMonthlyReport = async () => {
        try {
            const blob = await payrollService.downloadMonthlyReport(filters.year, filters.month);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `payroll_report_${MONTH_NAMES[filters.month - 1]}_${filters.year}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            toast.success('Monthly report downloaded');
        } catch {
            toast.error('Failed to download monthly report');
        }
    };

    // ─── PDF Yearly Report ───────────────────────────────────
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
            toast.success('Yearly report downloaded');
        } catch {
            toast.error('Failed to download yearly report');
        }
    };

    // ─── Payroll column picker config ───────────────────────
    const payrollExportColumns = [
        { key: 'employeeName', label: 'Employee Name', group: 'Employee', getValue: r => r.employeeId?.name || '' },
        { key: 'employeeIdCode', label: 'Employee ID', group: 'Employee', getValue: r => r.employeeId?.employeeId || '' },
        { key: 'designation', label: 'Designation', group: 'Employee', getValue: r => r.employeeId?.designation || '' },
        { key: 'department', label: 'Department', group: 'Employee', getValue: r => r.employeeId?.department || '' },
        { key: 'month', label: 'Month', group: 'Period', getValue: r => MONTH_NAMES[r.month - 1] || '' },
        { key: 'year', label: 'Year', group: 'Period', getValue: r => r.year || '' },
        { key: 'baseSalary', label: 'Base Salary', group: 'Salary', getValue: r => r.baseSalary || 0 },
        { key: 'bonuses', label: 'Bonuses', group: 'Salary', getValue: r => r.bonuses || 0 },
        { key: 'leaveDeduction', label: 'Leave Deductions', group: 'Deductions', getValue: r => r.leaveDeduction || 0 },
        { key: 'advanceDeduction', label: 'Advance Deductions', group: 'Deductions', getValue: r => r.totalAdvanceDeduction || 0 },
        { key: 'otherDeductions', label: 'Other Deductions', group: 'Deductions', getValue: r => r.otherDeductions || 0 },
        { key: 'totalDeductions', label: 'Total Deductions', group: 'Deductions', getValue: r => (r.leaveDeduction || 0) + (r.totalAdvanceDeduction || 0) + (r.otherDeductions || 0) },
        { key: 'netSalary', label: 'Net Salary', group: 'Salary', getValue: r => r.netSalary || 0 },
        { key: 'paymentStatus', label: 'Payment Status', group: 'Payment', getValue: r => r.paymentStatus || 'pending' },
        { key: 'paymentDate', label: 'Payment Date', group: 'Payment', getValue: r => r.paymentDate ? new Date(r.paymentDate).toLocaleDateString() : '' },
        { key: 'paymentMethod', label: 'Payment Method', group: 'Payment', getValue: r => r.paymentMethod || '' },
    ];

    const payrollExportPresets = {
        basic: { label: 'Basic', fields: ['employeeName', 'employeeIdCode', 'month', 'year', 'netSalary', 'paymentStatus'] },
        salary: { label: 'Salary Breakdown', fields: ['employeeName', 'employeeIdCode', 'baseSalary', 'bonuses', 'totalDeductions', 'netSalary'] },
        full: { label: 'Full Record', fields: ['employeeName', 'employeeIdCode', 'designation', 'department', 'month', 'year', 'baseSalary', 'bonuses', 'leaveDeduction', 'advanceDeduction', 'otherDeductions', 'netSalary', 'paymentStatus', 'paymentDate'] },
    };

    // ─── Bank Statement Export (NEFT/RTGS format) ───────────
    const handleExportBankStatement = () => {
        if (payrollRecords.length === 0) {
            toast.error('No records to export');
            return;
        }

        const paidRecords = payrollRecords.filter(r => r.paymentStatus === 'paid' || r.paymentStatus === 'pending');

        if (paidRecords.length === 0) {
            toast.error('No eligible records for bank transfer');
            return;
        }

        const headers = [
            'Sr No', 'Beneficiary Name', 'Account Number', 'IFSC Code',
            'Bank Name', 'Branch', 'Amount', 'Payment Mode',
            'Employee ID', 'Narration'
        ];

        const rows = paidRecords.map((r, idx) => {
            const emp = r.employeeId || {};
            return [
                idx + 1,
                emp.name || '',
                emp.accountNumber || '',
                emp.ifscCode || '',
                emp.bankName || '',
                '',
                r.netSalary || 0,
                'NEFT',
                emp.employeeId || '',
                `Salary ${MONTH_NAMES[r.month - 1]} ${r.year}`
            ];
        });

        const missingBankCount = paidRecords.filter(r => {
            const emp = r.employeeId || {};
            return !emp.accountNumber || !emp.ifscCode;
        }).length;

        const totalAmount = paidRecords.reduce((sum, r) => sum + (r.netSalary || 0), 0);

        exportReport(
            `bank_salary_transfer_${MONTH_NAMES[filters.month - 1]}_${filters.year}.xlsx`,
            {
                schoolName: settings?.institution?.name,
                reportTitle: `Bank Salary Transfer — ${MONTH_NAMES[filters.month - 1]} ${filters.year}`,
                headers, rows, sheetName: 'Bank Transfer',
                summary: [
                    { label: 'Total Amount', value: totalAmount },
                    { label: 'Total Beneficiaries', value: paidRecords.length },
                    { label: 'Payment Date', value: new Date().toLocaleDateString('en-IN') },
                ],
            }
        );
        if (missingBankCount > 0) {
            toast.success(`Bank transfer sheet downloaded · ${missingBankCount} employee(s) missing bank details`, { duration: 6000 });
        } else {
            toast.success('Bank transfer file downloaded');
        }
        setShowExportMenu(false);
    };

    // ─── ICICI NPAB Bank Upload Sheet ───────────────────────
    const handleOpenIciciModal = () => {
        setShowExportMenu(false);
        setShowIciciModal(true);
    };

    const handleDownloadIciciSheet = async () => {
        if (!/^\d{8,20}$/.test(iciciForm.debitAccountNo.trim())) {
            toast.error('Enter a valid ICICI debit account number (digits only)');
            return;
        }
        try {
            setIciciLoading(true);
            const result = await payrollService.downloadIciciBankSheet(filters.year, filters.month, {
                debitAccountNo: iciciForm.debitAccountNo.trim(),
                paymentMode: iciciForm.paymentMode,
                paymentDate: iciciForm.paymentDate,
                status: filters.status
            });
            const url = window.URL.createObjectURL(result.blob);
            const link = document.createElement('a');
            link.href = url;
            const monthAbbr = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][filters.month - 1];
            link.download = `ICICI_NPAB_${monthAbbr}_${filters.year}.xls`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            setShowIciciModal(false);

            const skippedCount = parseInt(result.skipped || '0', 10);
            const includedCount = parseInt(result.included || '0', 10);
            if (skippedCount > 0) {
                toast.success(`ICICI sheet downloaded · ${includedCount} included, ${skippedCount} skipped`, { duration: 6000 });
                console.warn('ICICI NPAB skipped employees:', result.skippedReasons);
            } else {
                toast.success(`ICICI NPAB sheet downloaded (${includedCount} employees)`);
            }
        } catch (err) {
            let message = 'Failed to download ICICI bank sheet';
            if (err.response?.data instanceof Blob) {
                try {
                    const text = await err.response.data.text();
                    message = JSON.parse(text).message || message;
                } catch { /* ignore */ }
            } else if (err.response?.data?.message) {
                message = err.response.data.message;
            }
            toast.error(message);
        } finally {
            setIciciLoading(false);
        }
    };

    // ─── Computed Stats ──────────────────────────────────────
    const stats = (() => {
        if (summaryData) {
            return {
                totalEmployees: summaryData.totalEmployees || summaryData.employeeCount || payrollRecords.length,
                totalSalary: summaryData.totalNetSalary || summaryData.totalSalary || 0,
                totalPaid: summaryData.paidCount || payrollRecords.filter(r => r.paymentStatus === 'paid').length,
                totalPending: summaryData.pendingCount || payrollRecords.filter(r => r.paymentStatus === 'pending').length,
            };
        }
        const totalSalary = payrollRecords.reduce((sum, r) => sum + (r.netSalary || 0), 0);
        const paidCount = payrollRecords.filter(r => r.paymentStatus === 'paid').length;
        const pendingCount = payrollRecords.filter(r => r.paymentStatus === 'pending').length;
        return {
            totalEmployees: payrollRecords.length,
            totalSalary,
            totalPaid: paidCount,
            totalPending: pendingCount,
        };
    })();

    // ─── Filtered Records (search) ──────────────────────────
    const filteredRecords = payrollRecords.filter(r => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            r.employeeId?.name?.toLowerCase().includes(term) ||
            r.employeeId?.employeeId?.toLowerCase().includes(term) ||
            r.employeeId?.designation?.toLowerCase().includes(term)
        );
    });

    const filteredAdvances = advanceRequests.filter(r => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            r.employeeId?.name?.toLowerCase().includes(term) ||
            r.employeeId?.employeeId?.toLowerCase().includes(term)
        );
    });

    // ─── Status Badge ────────────────────────────────────────
    const getStatusBadge = (status) => {
        const styles = {
            paid: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30',
            approved: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30',
            pending: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30',
            cancelled: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30',
            rejected: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30',
            deducted: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30',
            partial: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/30',
        };
        return (
            <span className={`px-2 py-0.5 inline-flex text-[11px] font-semibold rounded-md capitalize ${styles[status] || styles.pending}`}>
                {status}
            </span>
        );
    };

    if (sessionLoading) return <LoadingSpinner />;
    if (!currentSession) return <EmptyState icon={Calendar} title="No active academic session" description="Please activate an academic session first" />;

    return (
        <div className="space-y-6">
            {/* ═══ Header ═══ */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Payroll Management</h1>
                    <div className="flex items-center gap-3 mt-0.5">
                        <p className="text-sm text-gray-500 dark:text-[#8E8E93]">
                            {MONTH_NAMES[filters.month - 1]} {filters.year}
                        </p>
                        <AcademicSessionSelector
                            selectedSessionId={currentSession._id}
                            onSessionChange={setSelectedSession}
                        />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {activeTab === 'payroll' && (
                        <>
                            {/* Single unified Export dropdown */}
                            <div className="relative" ref={exportMenuRef}>
                                <button
                                    onClick={() => setShowExportMenu(!showExportMenu)}
                                    disabled={payrollRecords.length === 0}
                                    className="btn btn-outline gap-2"
                                >
                                    <Download className="h-4 w-4" />
                                    <span className="hidden sm:inline">Export</span>
                                    <ChevronDown className="h-3.5 w-3.5" />
                                </button>
                                {showExportMenu && (
                                    <div className="absolute right-0 mt-2 w-72 rounded-xl bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] shadow-xl shadow-black/10 dark:shadow-black/40 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                        {/* Data Export */}
                                        <div className="px-3 pt-2.5 pb-1">
                                            <p className="text-[10px] font-semibold text-gray-400 dark:text-[#636366] uppercase tracking-wider">Data Export</p>
                                        </div>
                                        <div className="py-1">
                                            <button
                                                onClick={() => { setShowExportMenu(false); setShowCustomExportModal(true); }}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 dark:text-[#E5E5EA] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors"
                                            >
                                                <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                                                <div className="text-left">
                                                    <div className="font-medium">Custom Export</div>
                                                    <div className="text-[11px] text-gray-400 dark:text-[#636366]">Pick columns · Excel, CSV or PDF</div>
                                                </div>
                                            </button>
                                        </div>
                                        {/* Reports */}
                                        <div className="px-3 pt-2.5 pb-1 border-t border-gray-100 dark:border-[#2C2C2E]">
                                            <p className="text-[10px] font-semibold text-gray-400 dark:text-[#636366] uppercase tracking-wider">Reports</p>
                                        </div>
                                        <div className="py-1">
                                            <button onClick={handleDownloadMonthlyReport} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 dark:text-[#E5E5EA] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors">
                                                <FileText className="h-4 w-4 text-red-500" />
                                                <div className="text-left">
                                                    <div className="font-medium">Monthly Report (PDF)</div>
                                                    <div className="text-[11px] text-gray-400 dark:text-[#636366]">Branded salary report</div>
                                                </div>
                                            </button>
                                        </div>
                                        {/* Bank Upload */}
                                        <div className="px-3 pt-2.5 pb-1 border-t border-gray-100 dark:border-[#2C2C2E]">
                                            <p className="text-[10px] font-semibold text-gray-400 dark:text-[#636366] uppercase tracking-wider">Bank Upload</p>
                                        </div>
                                        <div className="py-1 pb-2">
                                            <button onClick={handleExportBankStatement} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 dark:text-[#E5E5EA] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors">
                                                <Building2 className="h-4 w-4 text-blue-500" />
                                                <div className="text-left">
                                                    <div className="font-medium">Generic Bank Transfer (.xlsx)</div>
                                                    <div className="text-[11px] text-gray-400 dark:text-[#636366]">NEFT/RTGS sheet for any bank</div>
                                                </div>
                                            </button>
                                            <button onClick={handleOpenIciciModal} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 dark:text-[#E5E5EA] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors">
                                                <Building2 className="h-4 w-4 text-orange-500" />
                                                <div className="text-left">
                                                    <div className="font-medium">ICICI Bank Upload (.xls)</div>
                                                    <div className="text-[11px] text-gray-400 dark:text-[#636366]">NPAB format for ICICI CIB</div>
                                                </div>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                    <button
                        onClick={() => activeTab === 'payroll' ? setShowGenerateModal(true) : (() => { setAdvanceModalMode('create'); setShowAdvanceModal(true); })()}
                        className="btn btn-primary gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        <span className="hidden sm:inline">{activeTab === 'payroll' ? 'Generate Payroll' : 'New Advance'}</span>
                        <span className="sm:hidden">New</span>
                    </button>
                </div>
            </div>

            {/* ═══ KPI Cards ═══ */}
            {activeTab === 'payroll' && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <KpiCard
                        title="Total Salary"
                        value={formatCurrency(stats.totalSalary)}
                        Icon={IndianRupee}
                        isRefetching={payrollRefetching}
                    />
                    <KpiCard
                        title="Employees"
                        value={stats.totalEmployees}
                        Icon={Users}
                    />
                    <KpiCard
                        title="Paid"
                        value={stats.totalPaid}
                        Icon={CheckCircle}
                        trend={stats.totalPaid > 0 ? 'up' : 'flat'}
                        delta={stats.totalEmployees > 0 ? `${Math.round((stats.totalPaid / stats.totalEmployees) * 100)}%` : null}
                    />
                    <KpiCard
                        title="Pending"
                        value={stats.totalPending}
                        Icon={Clock}
                        trend={stats.totalPending > 0 ? 'down' : 'flat'}
                        delta={stats.totalPending > 0 ? `${stats.totalPending} left` : null}
                    />
                </div>
            )}

            {/* ═══ Tabs ═══ */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex gap-1 p-1 bg-gray-100 rounded-xl dark:bg-[#2C2C2E]">
                    <button
                        onClick={() => { setActiveTab('payroll'); setSearchTerm(''); }}
                        className={`px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${activeTab === 'payroll'
                            ? 'bg-white dark:bg-[#1C1C1E] text-gray-900 shadow-sm dark:text-white'
                            : 'text-gray-500 hover:text-gray-700 dark:text-[#8E8E93] dark:hover:text-white'
                        }`}
                    >
                        Payroll Records
                    </button>
                    <button
                        onClick={() => { setActiveTab('advances'); setSearchTerm(''); }}
                        className={`px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${activeTab === 'advances'
                            ? 'bg-white dark:bg-[#1C1C1E] text-gray-900 shadow-sm dark:text-white'
                            : 'text-gray-500 hover:text-gray-700 dark:text-[#8E8E93] dark:hover:text-white'
                        }`}
                    >
                        Advance Salary
                    </button>
                </div>
            </div>

            {/* ═══ Error ═══ */}
            {payrollError && (
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200/60 dark:border-red-500/20 rounded-2xl p-4 animate-fade-in">
                    <div className="flex items-center">
                        <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2 flex-shrink-0" />
                        <p className="text-sm text-red-700 dark:text-red-400">{payrollError.response?.data?.message || 'Failed to load payroll data. Please try again.'}</p>
                    </div>
                    <button onClick={() => refetchPayroll()} className="mt-2 inline-flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 underline">
                        <RefreshCw className="h-3.5 w-3.5" />
                        Try again
                    </button>
                </div>
            )}

            {/* ═══ Payroll Records Tab ═══ */}
            {activeTab === 'payroll' && (
                <div className="space-y-4">
                    {/* Filters */}
                    <div className="card p-4">
                        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-3">
                                <select
                                    value={filters.month}
                                    onChange={(e) => setFilters({ ...filters, month: parseInt(e.target.value), page: 1 })}
                                    className="input w-full sm:w-auto"
                                >
                                    {MONTH_NAMES.map((month, index) => (
                                        <option key={index} value={index + 1}>{month}</option>
                                    ))}
                                </select>
                                <input
                                    type="number"
                                    value={filters.year}
                                    onChange={(e) => setFilters({ ...filters, year: parseInt(e.target.value), page: 1 })}
                                    min="2000" max="2100"
                                    className="input w-full sm:w-24"
                                />
                                <select
                                    value={filters.status}
                                    onChange={(e) => setFilters({ ...filters, status: e.target.value, page: 1 })}
                                    className="input w-full sm:w-auto"
                                >
                                    <option value="">All Status</option>
                                    <option value="pending">Pending</option>
                                    <option value="paid">Paid</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                                {stats.totalPending > 0 && (
                                    <button
                                        onClick={handleBulkMarkAsPaid}
                                        disabled={bulkMarkAsPaidMutation.isPending}
                                        className="btn btn-sm bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 whitespace-nowrap"
                                    >
                                        <CheckCircle className="h-3.5 w-3.5" />
                                        {bulkMarkAsPaidMutation.isPending ? 'Processing...' : `Mark All Paid (${stats.totalPending})`}
                                    </button>
                                )}
                            </div>
                            <div className="relative w-full lg:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#636366]" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search employee..."
                                    className="input !pl-9 w-full"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="card overflow-hidden">
                        {loading ? (
                            <LoadingSpinner />
                        ) : filteredRecords.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[800px]">
                                    <thead>
                                        <tr className="bg-gray-50/80 dark:bg-[#2C2C2E] border-b border-gray-100 dark:border-[#38383A]">
                                            <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Employee</th>
                                            <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Period</th>
                                            <th className="px-5 py-3 text-right text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Base Salary</th>
                                            <th className="px-5 py-3 text-right text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Deductions</th>
                                            <th className="px-5 py-3 text-right text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Net Salary</th>
                                            <th className="px-5 py-3 text-center text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Status</th>
                                            <th className="px-5 py-3 text-right text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-[#2C2C2E]">
                                        {filteredRecords.map((record) => {
                                            const totalDeductions = (record.otherDeductions || 0) + (record.totalAdvanceDeduction || 0) + (record.leaveDeduction || 0);
                                            return (
                                                <tr key={record._id} className="hover:bg-gray-50/50 dark:hover:bg-[#1C1C1E]/50 transition-colors">
                                                    <td className="px-5 py-3.5 whitespace-nowrap">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-8 w-8 rounded-full bg-primary-50 dark:bg-[rgba(62,196,177,0.12)] flex items-center justify-center flex-shrink-0">
                                                                <span className="text-xs font-bold text-primary-600 dark:text-[#3EC4B1]">
                                                                    {record.employeeId?.name?.charAt(0)?.toUpperCase() || '?'}
                                                                </span>
                                                            </div>
                                                            <div>
                                                                <div className="text-sm font-medium text-gray-900 dark:text-white">{record.employeeId?.name}</div>
                                                                <div className="text-[11px] text-gray-400 dark:text-[#636366]">{record.employeeId?.employeeId}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-600 dark:text-[#8E8E93]">
                                                        {MONTH_NAMES[record.month - 1]} {record.year}
                                                    </td>
                                                    <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 text-right tabular-nums">
                                                        {formatCurrency(record.baseSalary)}
                                                    </td>
                                                    <td className="px-5 py-3.5 whitespace-nowrap text-sm text-red-600 dark:text-red-400 text-right tabular-nums">
                                                        {totalDeductions > 0 ? `- ${formatCurrency(totalDeductions)}` : '—'}
                                                    </td>
                                                    <td className="px-5 py-3.5 whitespace-nowrap text-sm font-semibold text-emerald-600 dark:text-emerald-400 text-right tabular-nums">
                                                        {formatCurrency(record.netSalary)}
                                                    </td>
                                                    <td className="px-5 py-3.5 whitespace-nowrap text-center">
                                                        {record.paymentStatus === 'pending' ? (
                                                            <button
                                                                onClick={() => handleMarkAsPaid(record._id)}
                                                                className="group/pay relative inline-flex items-center justify-center min-w-[80px] px-2 py-0.5 text-[11px] font-semibold rounded-md bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/30 hover:bg-emerald-50 hover:text-emerald-700 hover:ring-emerald-600/20 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400 dark:hover:ring-emerald-500/30 transition-colors cursor-pointer"
                                                                title="Click to mark as paid"
                                                                disabled={markAsPaidMutation.isPending}
                                                            >
                                                                <span className="group-hover/pay:invisible">Pending</span>
                                                                <span className="invisible group-hover/pay:visible absolute inset-0 flex items-center justify-center gap-1">
                                                                    <CheckCircle className="h-3 w-3" /> Mark Paid
                                                                </span>
                                                            </button>
                                                        ) : (
                                                            getStatusBadge(record.paymentStatus)
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-3.5 whitespace-nowrap">
                                                        <div className="flex items-center justify-end gap-1">
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
                                            );
                                        })}
                                    </tbody>
                                    {/* Table Footer — Totals */}
                                    {filteredRecords.length > 1 && (
                                        <tfoot>
                                            <tr className="bg-gray-50/60 dark:bg-[#2C2C2E]/60 border-t-2 border-gray-200 dark:border-[#38383A]">
                                                <td colSpan={2} className="px-5 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                                    Total ({filteredRecords.length} employees)
                                                </td>
                                                <td className="px-5 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 text-right tabular-nums">
                                                    {formatCurrency(filteredRecords.reduce((s, r) => s + (r.baseSalary || 0), 0))}
                                                </td>
                                                <td className="px-5 py-3 text-sm font-semibold text-red-600 dark:text-red-400 text-right tabular-nums">
                                                    {formatCurrency(filteredRecords.reduce((s, r) => s + (r.otherDeductions || 0) + (r.totalAdvanceDeduction || 0) + (r.leaveDeduction || 0), 0))}
                                                </td>
                                                <td className="px-5 py-3 text-sm font-bold text-emerald-600 dark:text-emerald-400 text-right tabular-nums">
                                                    {formatCurrency(filteredRecords.reduce((s, r) => s + (r.netSalary || 0), 0))}
                                                </td>
                                                <td colSpan={2} />
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        ) : (
                            <EmptyState
                                icon={Wallet}
                                title="No payroll records found"
                                description={searchTerm ? 'Try a different search term' : 'Generate payroll for this period to get started'}
                                action={!searchTerm && (
                                    <button onClick={() => setShowGenerateModal(true)} className="btn btn-primary gap-2">
                                        <Plus className="h-4 w-4" />
                                        Generate Payroll
                                    </button>
                                )}
                            />
                        )}

                        {/* Pagination */}
                        {payrollPagination.pages > 1 && (
                            <div className="px-5 py-3 border-t border-gray-100 dark:border-[#38383A] flex items-center justify-between">
                                <div className="text-[13px] text-gray-500 dark:text-[#8E8E93]">
                                    Page {payrollPagination.current} of {payrollPagination.pages} &middot; {payrollPagination.total} records
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setFilters({ ...filters, page: filters.page - 1 })} disabled={filters.page === 1} className="btn btn-sm btn-outline">Previous</button>
                                    <button onClick={() => setFilters({ ...filters, page: filters.page + 1 })} disabled={filters.page === payrollPagination.pages} className="btn btn-sm btn-outline">Next</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══ Advance Salary Tab ═══ */}
            {activeTab === 'advances' && (
                <div className="space-y-4">
                    {/* Filters */}
                    <div className="card p-4">
                        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
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
                            <div className="relative w-full lg:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#636366]" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Search employee..."
                                    className="input !pl-9 w-full"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="card overflow-hidden">
                        {loading ? (
                            <LoadingSpinner />
                        ) : filteredAdvances.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[700px]">
                                    <thead>
                                        <tr className="bg-gray-50/80 dark:bg-[#2C2C2E] border-b border-gray-100 dark:border-[#38383A]">
                                            <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Employee</th>
                                            <th className="px-5 py-3 text-right text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Amount</th>
                                            <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Reason</th>
                                            <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Request Date</th>
                                            <th className="px-5 py-3 text-center text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Status</th>
                                            <th className="px-5 py-3 text-center text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Deduction</th>
                                            <th className="px-5 py-3 text-right text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-[#2C2C2E]">
                                        {filteredAdvances.map((request) => (
                                            <tr key={request._id} className="hover:bg-gray-50/50 dark:hover:bg-[#1C1C1E]/50 transition-colors">
                                                <td className="px-5 py-3.5 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                                                            <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                                                                {request.employeeId?.name?.charAt(0)?.toUpperCase() || '?'}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-medium text-gray-900 dark:text-white">{request.employeeId?.name}</div>
                                                            <div className="text-[11px] text-gray-400 dark:text-[#636366]">{request.employeeId?.employeeId}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-3.5 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white text-right tabular-nums">
                                                    {formatCurrency(request.amount)}
                                                </td>
                                                <td className="px-5 py-3.5 text-sm text-gray-600 dark:text-[#8E8E93] max-w-[200px] truncate">
                                                    {request.reason}
                                                </td>
                                                <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-500 dark:text-[#8E8E93]">
                                                    {new Date(request.requestDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </td>
                                                <td className="px-5 py-3.5 whitespace-nowrap text-center">{getStatusBadge(request.status)}</td>
                                                <td className="px-5 py-3.5 whitespace-nowrap text-center">
                                                    {request.status === 'approved' ? getStatusBadge(request.deductionStatus) : <span className="text-[11px] text-gray-300 dark:text-[#48484A]">—</span>}
                                                </td>
                                                <td className="px-5 py-3.5 whitespace-nowrap text-right">
                                                    <button
                                                        onClick={() => { setSelectedAdvance(request); setAdvanceModalMode('view'); setShowAdvanceModal(true); }}
                                                        className={`text-[13px] font-medium transition-colors ${
                                                            request.status === 'pending'
                                                                ? 'text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300'
                                                                : 'text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300'
                                                        }`}
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
                            <EmptyState
                                icon={ArrowUpRight}
                                title="No advance requests found"
                                description={searchTerm ? 'Try a different search term' : 'No advance salary requests for the current filters'}
                            />
                        )}

                        {advancePagination.pages > 1 && (
                            <div className="px-5 py-3 border-t border-gray-100 dark:border-[#38383A] flex items-center justify-between">
                                <div className="text-[13px] text-gray-500 dark:text-[#8E8E93]">
                                    Page {advancePagination.current} of {advancePagination.pages} &middot; {advancePagination.total} records
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setAdvanceFilters({ ...advanceFilters, page: advanceFilters.page - 1 })} disabled={advanceFilters.page === 1} className="btn btn-sm btn-outline">Previous</button>
                                    <button onClick={() => setAdvanceFilters({ ...advanceFilters, page: advanceFilters.page + 1 })} disabled={advanceFilters.page === advancePagination.pages} className="btn btn-sm btn-outline">Next</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══ Modals ═══ */}
            <GeneratePayrollModal isOpen={showGenerateModal} onClose={() => setShowGenerateModal(false)} onSuccess={handleGenerateSuccess} />
            <AdvanceSalaryModal isOpen={showAdvanceModal} onClose={() => { setShowAdvanceModal(false); setSelectedAdvance(null); }} onSuccess={handleAdvanceSuccess} mode={advanceModalMode} advanceData={selectedAdvance} />
            <PayrollDetailsModal isOpen={showDetailsModal} onClose={() => { setShowDetailsModal(false); setSelectedPayrollId(null); }} payrollId={selectedPayrollId} />
            <EditPayrollModal isOpen={showEditModal} onClose={() => { setShowEditModal(false); setSelectedPayroll(null); }} payrollData={selectedPayroll} onSuccess={handleEditSuccess} />

            {/* Custom export column-picker modal (controlled) */}
            <ExportColumnPicker
                hideTrigger
                externalOpen={showCustomExportModal}
                onExternalClose={() => setShowCustomExportModal(false)}
                data={payrollRecords}
                columns={payrollExportColumns}
                presets={payrollExportPresets}
                filename={`payroll_${MONTH_NAMES[filters.month - 1]}_${filters.year}`}
                title="Custom Payroll Export"
                sheetName="Payroll"
            />

            {/* ═══ ICICI NPAB Bank Upload Modal ═══ */}
            {showIciciModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-2xl max-w-md w-full border border-gray-100 dark:border-[#38383A] animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 dark:border-[#38383A] flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-semibold text-gray-900 dark:text-white tracking-tight">ICICI Bank Upload Sheet</h3>
                                <p className="text-[11px] text-gray-500 dark:text-[#8E8E93] mt-0.5">
                                    {MONTH_NAMES[filters.month - 1]} {filters.year} payroll · NPAB format
                                </p>
                            </div>
                            <button
                                onClick={() => setShowIciciModal(false)}
                                disabled={iciciLoading}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 disabled:opacity-50"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                            <div>
                                <label className="block text-[13px] font-medium text-gray-700 dark:text-[#E5E5EA] mb-1.5">
                                    ICICI Debit Account Number <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={iciciForm.debitAccountNo}
                                    onChange={(e) => setIciciForm({ ...iciciForm, debitAccountNo: e.target.value.replace(/\D/g, '') })}
                                    placeholder="e.g. 123456789012"
                                    maxLength={20}
                                    className="input w-full"
                                />
                                <p className="text-[11px] text-gray-400 dark:text-[#8E8E93] mt-1">School's ICICI account from which salaries will be debited.</p>
                            </div>

                            <div>
                                <label className="block text-[13px] font-medium text-gray-700 dark:text-[#E5E5EA] mb-1.5">Payment Mode</label>
                                <select
                                    value={iciciForm.paymentMode}
                                    onChange={(e) => setIciciForm({ ...iciciForm, paymentMode: e.target.value })}
                                    className="input w-full"
                                >
                                    <option value="NEFT">NEFT (any bank)</option>
                                    <option value="RTGS">RTGS (≥ ₹2,00,000)</option>
                                    <option value="IMPS">IMPS (instant)</option>
                                    <option value="FT">FT (ICICI to ICICI only)</option>
                                </select>
                                <p className="text-[11px] text-gray-400 dark:text-[#8E8E93] mt-1">Employees with ICICI accounts (IFSC starting with ICIC) automatically use FT regardless of this selection.</p>
                            </div>

                            <div>
                                <label className="block text-[13px] font-medium text-gray-700 dark:text-[#E5E5EA] mb-1.5">Payment Date</label>
                                <input
                                    type="date"
                                    value={iciciForm.paymentDate ? iciciForm.paymentDate.split('-').reverse().join('-') : ''}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setIciciForm({
                                            ...iciciForm,
                                            paymentDate: val ? val.split('-').reverse().join('-') : ''
                                        });
                                    }}
                                    className="input w-full"
                                />
                                <p className="text-[11px] text-gray-400 dark:text-[#8E8E93] mt-1">Leave blank to use today's date.</p>
                            </div>

                            <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-3 py-2.5">
                                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                                    Employees without a saved bank account number or IFSC will be skipped. Check employee profiles before generating.
                                </p>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-gray-100 dark:border-[#38383A] flex justify-end gap-2">
                            <button
                                onClick={() => setShowIciciModal(false)}
                                disabled={iciciLoading}
                                className="btn btn-outline"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDownloadIciciSheet}
                                disabled={iciciLoading || !iciciForm.debitAccountNo}
                                className="btn btn-primary gap-2"
                            >
                                {iciciLoading ? 'Generating...' : 'Download .xls'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Payroll;
