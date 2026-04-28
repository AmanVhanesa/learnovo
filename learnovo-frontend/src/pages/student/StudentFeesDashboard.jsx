import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { CreditCard, History, AlertTriangle, FileText, CheckCircle, Clock, X, ExternalLink, Download, Lock, ShieldCheck, Upload, IndianRupee, Filter, ChevronDown, ArrowUpDown, RotateCcw, SlidersHorizontal, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { studentFeesService } from '../../services/studentFeesService';
import { formatCurrency } from '../../utils/formatCurrency';
import { SERVER_URL } from '../../constants/config';
import { useSettings } from '../../contexts/SettingsContext';
import { useChild } from '../../contexts/ChildContext';

// Format date
const formatDate = (dateString, withTime = false) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (withTime) {
        return date.toLocaleString('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }
    return date.toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
};

const StudentFeesDashboard = () => {
    const { settings: schoolSettings } = useSettings();
    const { isParent, selectedChildId, selectedChild } = useChild();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('invoices'); // invoices, history
    const [selectedInvoice, setSelectedInvoice] = useState(null); // Triggers Invoice Detail Modal
    const [paymentModal, setPaymentModal] = useState({ isOpen: false, invoice: null }); // Manual payment form
    const [paymentConfirmation, setPaymentConfirmation] = useState(false); // Post-submission confirmation
    const [paymentForm, setPaymentForm] = useState({
        paymentMode: '', transactionRefId: '', amount: '', paymentDate: new Date().toISOString().split('T')[0]
    });

    const [disputeModal, setDisputeModal] = useState({ isOpen: false, attemptId: null, invoiceId: null });
    const [disputeForm, setDisputeForm] = useState({ transactionId: '', bankReferenceNumber: '', amount: '', studentNote: '' });

    // Multi-invoice selection for combined payment
    const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([]);

    // Filter & sort state synced with URL search params
    const [searchParams, setSearchParams] = useSearchParams();
    const [filterQuarter, setFilterQuarter] = useState(searchParams.get('quarter') || 'all');
    const [filterStatus, setFilterStatus] = useState(searchParams.get('status') || 'all');
    const [filterYear, setFilterYear] = useState(searchParams.get('year') || 'all');
    const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'due_asc');
    const [showMobileFilters, setShowMobileFilters] = useState(false);

    // Sync filters to URL
    useEffect(() => {
        const params = {};
        if (filterQuarter !== 'all') params.quarter = filterQuarter;
        if (filterStatus !== 'all') params.status = filterStatus;
        if (filterYear !== 'all') params.year = filterYear;
        if (sortBy !== 'due_asc') params.sort = sortBy;
        setSearchParams(params, { replace: true });
    }, [filterQuarter, filterStatus, filterYear, sortBy, setSearchParams]);

    const hasActiveFilters = filterQuarter !== 'all' || filterStatus !== 'all' || filterYear !== 'all';

    const clearFilters = useCallback(() => {
        setFilterQuarter('all');
        setFilterStatus('all');
        setFilterYear('all');
        setSortBy('due_asc');
    }, []);

    // Check if online payment gateway is enabled for this tenant (per-tenant, not global flag)
    const { data: gatewayStatus } = useQuery({
        queryKey: ['gateway-status'],
        queryFn: async () => {
            const res = await studentFeesService.getGatewayStatus();
            return res.data?.data || { gatewayEnabled: false, provider: 'none' };
        },
        staleTime: 5 * 60 * 1000, // cache for 5 min — rarely changes
    });
    const PAYMENT_GATEWAY_ENABLED = gatewayStatus?.gatewayEnabled || false;

    // Dynamically load Razorpay checkout script when provider is razorpay
    useEffect(() => {
        if (gatewayStatus?.provider !== 'razorpay') return;
        if (document.getElementById('razorpay-checkout-script')) return;
        const script = document.createElement('script');
        script.id = 'razorpay-checkout-script';
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        document.body.appendChild(script);
    }, [gatewayStatus?.provider]);

    // Fetch invoices and history via useQuery
    const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
        queryKey: ['student-invoices', selectedChildId],
        queryFn: async () => {
            const res = await studentFeesService.getInvoices(selectedChildId);
            return res.data?.data || [];
        },
        enabled: !isParent || !!selectedChildId,
    });

    const { data: history = [], isLoading: historyLoading } = useQuery({
        queryKey: ['student-payment-history', selectedChildId],
        queryFn: async () => {
            const res = await studentFeesService.getHistory(selectedChildId);
            return res.data?.data || [];
        },
        enabled: !isParent || !!selectedChildId,
    });

    const { data: receipts = [], isLoading: receiptsLoading } = useQuery({
        queryKey: ['student-receipts', selectedChildId],
        queryFn: async () => {
            const res = await studentFeesService.getReceipts(selectedChildId);
            return res.data?.data || [];
        },
        enabled: !isParent || !!selectedChildId,
    });

    const isLoading = invoicesLoading || historyLoading;

    // Smart polling: only poll when there are pending/processing payments, respect tab visibility
    const hasPendingPayments = history.some(h => ['PENDING', 'PROCESSING', 'INITIATED'].includes(h.status));
    useEffect(() => {
        if (!hasPendingPayments) return;
        const poll = setInterval(() => {
            if (!document.hidden) {
                queryClient.invalidateQueries({ queryKey: ['student-invoices'] });
                queryClient.invalidateQueries({ queryKey: ['student-payment-history'] });
            }
        }, 10000); // 10 sec when payments are pending
        const onVisible = () => {
            if (!document.hidden) {
                queryClient.invalidateQueries({ queryKey: ['student-invoices'] });
                queryClient.invalidateQueries({ queryKey: ['student-payment-history'] });
            }
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => { clearInterval(poll); document.removeEventListener('visibilitychange', onVisible); };
    }, [hasPendingPayments, queryClient]);

    // Gateway payment flow — supports both ICICI (redirect) and Razorpay (popup)
    const [isGatewayPaying, setIsGatewayPaying] = useState(false);
    const handleGatewayPayment = async (invoiceId) => {
        try {
            setIsGatewayPaying(true);
            const res = await studentFeesService.initiatePayment(invoiceId);
            const data = res.data?.data;
            if (!res.data?.success || !data) throw new Error('Failed to initiate payment');

            if (data.paymentUrl) {
                // ICICI / redirect-based flow
                const paymentWindow = window.open(data.paymentUrl, '_blank');
                if (!paymentWindow) window.location.href = data.paymentUrl;
                toast.success('Redirecting to payment gateway...');
                setTimeout(() => {
                    queryClient.invalidateQueries({ queryKey: ['student-invoices'] });
                    queryClient.invalidateQueries({ queryKey: ['student-payment-history'] });
                }, 1500);
            } else if (data.razorpayOrder) {
                // Razorpay popup flow
                const { orderId, amount, currency, keyId } = data.razorpayOrder;
                const options = {
                    key: keyId,
                    amount,
                    currency,
                    order_id: orderId,
                    name: schoolSettings?.schoolName || 'School Fees',
                    description: 'Fee Payment',
                    handler: async (response) => {
                        try {
                            const verifyRes = await studentFeesService.verifyRazorpayPayment({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                paymentAttemptId: data.paymentAttemptId
                            });
                            if (verifyRes.data?.success) {
                                toast.success('Payment successful!');
                            } else {
                                toast.error('Payment verification failed. Contact school office.');
                            }
                        } catch {
                            toast.error('Payment verification failed. Please check your payment history.');
                        }
                        queryClient.invalidateQueries({ queryKey: ['student-invoices'] });
                        queryClient.invalidateQueries({ queryKey: ['student-payment-history'] });
                        queryClient.invalidateQueries({ queryKey: ['student-receipts'] });
                    },
                    modal: {
                        ondismiss: () => {
                            toast('Payment cancelled', { icon: '⚠️' });
                            queryClient.invalidateQueries({ queryKey: ['student-payment-history'] });
                        }
                    },
                    theme: { color: '#4F46E5' }
                };
                const rzp = new window.Razorpay(options);
                rzp.open();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || error.message || 'Failed to initiate payment');
        } finally {
            setIsGatewayPaying(false);
        }
    };

    // Cancel a stuck INITIATED/PROCESSING attempt then retry payment for the same invoice
    const [isAbandoning, setIsAbandoning] = useState(false);
    const handleAbandonAndRetry = async (invoiceId) => {
        const stuck = history.find(h => h.invoiceId?._id === invoiceId && ['PENDING', 'PROCESSING', 'INITIATED'].includes(h.status));
        if (!stuck) {
            return handleGatewayPayment(invoiceId);
        }
        try {
            setIsAbandoning(true);
            const res = await studentFeesService.abandonAttempt(stuck._id);
            if (!res.data?.success) {
                toast.error(res.data?.message || 'Could not cancel previous attempt');
                return;
            }
            toast.success('Previous attempt cancelled. Starting a new payment…');
            await queryClient.invalidateQueries({ queryKey: ['student-invoices'] });
            await queryClient.invalidateQueries({ queryKey: ['student-payment-history'] });
            await handleGatewayPayment(invoiceId);
        } catch (error) {
            toast.error(error.response?.data?.message || error.message || 'Could not cancel previous attempt');
        } finally {
            setIsAbandoning(false);
        }
    };

    // Combined payment for multiple selected invoices
    const handleCombinedPayment = async () => {
        if (selectedInvoiceIds.length < 2) return;
        try {
            setIsGatewayPaying(true);
            const res = await studentFeesService.initiateCombinedPayment(selectedInvoiceIds);
            const data = res.data?.data;
            if (!res.data?.success || !data) throw new Error('Failed to initiate combined payment');

            if (data.paymentUrl) {
                const paymentWindow = window.open(data.paymentUrl, '_blank');
                if (!paymentWindow) window.location.href = data.paymentUrl;
                toast.success(`Redirecting to pay ${data.invoiceCount} invoices...`);
                setTimeout(() => {
                    queryClient.invalidateQueries({ queryKey: ['student-invoices'] });
                    queryClient.invalidateQueries({ queryKey: ['student-payment-history'] });
                }, 1500);
            } else if (data.razorpayOrder) {
                const { orderId, amount, currency, keyId } = data.razorpayOrder;
                const options = {
                    key: keyId, amount, currency, order_id: orderId,
                    name: schoolSettings?.schoolName || 'School Fees',
                    description: `Combined payment for ${data.invoiceCount} invoices`,
                    handler: async (response) => {
                        try {
                            const verifyRes = await studentFeesService.verifyRazorpayPayment({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                paymentAttemptId: data.paymentAttemptId
                            });
                            if (verifyRes.data?.success) toast.success('Payment successful!');
                            else toast.error('Payment verification failed. Contact school office.');
                        } catch { toast.error('Payment verification failed.'); }
                        queryClient.invalidateQueries({ queryKey: ['student-invoices'] });
                        queryClient.invalidateQueries({ queryKey: ['student-payment-history'] });
                        queryClient.invalidateQueries({ queryKey: ['student-receipts'] });
                        setSelectedInvoiceIds([]);
                    },
                    modal: { ondismiss: () => { toast('Payment cancelled', { icon: '⚠️' }); } },
                    theme: { color: '#4F46E5' }
                };
                const rzp = new window.Razorpay(options);
                rzp.open();
            }
            setSelectedInvoiceIds([]);
        } catch (error) {
            toast.error(error.response?.data?.message || error.message || 'Failed to initiate combined payment');
        } finally {
            setIsGatewayPaying(false);
        }
    };

    // Combined manual payment for multiple invoices
    const handleCombinedManualPayment = () => {
        if (selectedInvoiceIds.length < 2) return;
        const selected = invoices.filter(inv => selectedInvoiceIds.includes(inv._id));
        const totalBalance = selected.reduce((sum, inv) => sum + (inv.balanceAmount || 0), 0);
        setPaymentForm({
            paymentMode: '',
            transactionRefId: '',
            amount: String(totalBalance),
            paymentDate: new Date().toISOString().split('T')[0]
        });
        setSelectedInvoice(null);
        setPaymentModal({ isOpen: true, invoice: null, combinedInvoiceIds: selectedInvoiceIds, combinedTotal: totalBalance });
    };

    // Toggle invoice selection
    const toggleInvoiceSelection = (invoiceId) => {
        setSelectedInvoiceIds(prev =>
            prev.includes(invoiceId) ? prev.filter(id => id !== invoiceId) : [...prev, invoiceId]
        );
    };

    // Open manual payment form for an invoice
    const openPaymentForm = (invoice) => {
        setPaymentForm({
            paymentMode: '',
            transactionRefId: '',
            amount: String(invoice.balanceAmount),
            paymentDate: new Date().toISOString().split('T')[0]
        });
        setSelectedInvoice(null); // Close invoice detail modal
        setPaymentModal({ isOpen: true, invoice });
    };

    // Submit manual payment proof (single or combined)
    const submitPaymentMutation = useMutation({
        mutationFn: async ({ invoiceId, invoiceIds, data }) => {
            if (invoiceIds && invoiceIds.length >= 2) {
                return studentFeesService.submitCombinedManualPayment(invoiceIds, data);
            }
            return studentFeesService.submitManualPayment(invoiceId, data);
        },
        onSuccess: () => {
            setPaymentModal({ isOpen: false, invoice: null });
            setPaymentConfirmation(true);
            setSelectedInvoiceIds([]);
            queryClient.invalidateQueries({ queryKey: ['student-invoices'] });
            queryClient.invalidateQueries({ queryKey: ['student-payment-history'] });
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Failed to submit payment');
        },
    });

    const handleSubmitPayment = (e) => {
        e.preventDefault();
        const inv = paymentModal.invoice;
        const combinedIds = paymentModal.combinedInvoiceIds;

        if (!inv && !combinedIds) return;

        submitPaymentMutation.mutate({
            invoiceId: inv?._id,
            invoiceIds: combinedIds,
            data: {
                paymentMode: paymentForm.paymentMode,
                amount: Number(paymentForm.amount),
                paymentDate: paymentForm.paymentDate,
                transactionRefId: paymentForm.transactionRefId || null,
            }
        });
    };

    // Submit dispute mutation
    const submitDisputeMutation = useMutation({
        mutationFn: async (formData) => {
            return studentFeesService.raiseDispute(formData);
        },
        onSuccess: () => {
            toast.success('Dispute raised successfully. Admin will review shortly.');
            setDisputeModal({ isOpen: false, attemptId: null, invoiceId: null });
            setDisputeForm({ transactionId: '', bankReferenceNumber: '', amount: '', studentNote: '' });
            queryClient.invalidateQueries({ queryKey: ['student-invoices'] });
            queryClient.invalidateQueries({ queryKey: ['student-payment-history'] });
        },
        onError: (error) => {
            toast.error(error.response?.data?.message || 'Failed to submit dispute');
        },
    });

    const submitDispute = async (e) => {
        e.preventDefault();
        submitDisputeMutation.mutate({
            invoiceId: disputeModal.invoiceId,
            paymentAttemptId: disputeModal.attemptId,
            ...disputeForm
        });
    };

    const handleDownloadReceipt = async (attempt) => {
        const toastId = toast.loading('Generating PDF...', { id: 'receipt-dl' });
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${SERVER_URL}/api/student-fees/receipt/${attempt._id}/pdf`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed');
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Receipt.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 10000);
            toast.dismiss(toastId);
            toast.success('Receipt downloaded');
        } catch {
            toast.dismiss(toastId);
            toast.error('Receipt unavailable');
        }
    }

    const handleViewReceipt = async (attempt) => {
        const toastId = toast.loading('Opening receipt...');
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${SERVER_URL}/api/student-fees/receipt/${attempt._id}/html`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed');
            const html = await response.text();
            toast.dismiss(toastId);
            const win = window.open('', '_blank', 'width=850,height=700');
            if (win) { win.document.write(html); win.document.close(); }
            else toast.error('Pop-up blocked — please allow pop-ups');
        } catch {
            toast.dismiss(toastId);
            toast.error('Receipt unavailable');
        }
    }

    const totalOutstanding = invoices.reduce((sum, inv) => sum + (inv.balanceAmount || 0), 0);

    // Derive available years from invoices
    const availableYears = useMemo(() => {
        const years = new Set();
        invoices.forEach(inv => {
            if (inv.billingPeriod?.year) years.add(inv.billingPeriod.year);
            else if (inv.dueDate) years.add(new Date(inv.dueDate).getFullYear());
        });
        return [...years].sort();
    }, [invoices]);

    // Status counts for quick filter chips
    const statusCounts = useMemo(() => {
        const counts = { Pending: 0, Overdue: 0, Paid: 0, Partial: 0 };
        invoices.forEach(inv => { if (counts[inv.status] !== undefined) counts[inv.status]++; });
        return counts;
    }, [invoices]);

    // Filtered & sorted invoices
    const filteredInvoices = useMemo(() => {
        let result = [...invoices];

        // Quarter filter
        if (filterQuarter !== 'all') {
            const qNum = parseInt(filterQuarter);
            result = result.filter(inv => inv.billingPeriod?.quarter === qNum);
        }

        // Status filter
        if (filterStatus !== 'all') {
            result = result.filter(inv => inv.status === filterStatus);
        }

        // Year filter
        if (filterYear !== 'all') {
            const yr = parseInt(filterYear);
            result = result.filter(inv => {
                if (inv.billingPeriod?.year) return inv.billingPeriod.year === yr;
                if (inv.dueDate) return new Date(inv.dueDate).getFullYear() === yr;
                return false;
            });
        }

        // Sort
        result.sort((a, b) => {
            switch (sortBy) {
                case 'due_desc':
                    return new Date(b.dueDate) - new Date(a.dueDate);
                case 'amount_asc':
                    return (a.totalAmount || 0) - (b.totalAmount || 0);
                case 'amount_desc':
                    return (b.totalAmount || 0) - (a.totalAmount || 0);
                case 'due_asc':
                default:
                    return new Date(a.dueDate) - new Date(b.dueDate);
            }
        });

        return result;
    }, [invoices, filterQuarter, filterStatus, filterYear, sortBy]);

    // Payable invoices from the FILTERED set (for "select all unpaid")
    const filteredPayable = useMemo(() =>
        filteredInvoices.filter(inv => inv.balanceAmount > 0 && inv.status !== 'Paid'),
        [filteredInvoices]
    );

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
            {/* Child indicator for parent view */}
            {isParent && selectedChild && (
                <div className="flex items-center gap-3 px-4 py-3 bg-primary-50 dark:bg-[rgba(62,196,177,0.08)] rounded-xl ring-1 ring-primary-200 dark:ring-[rgba(62,196,177,0.2)]">
                    <div className="h-8 w-8 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-semibold text-white">
                            {selectedChild.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                        </span>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-800 dark:text-white">
                            Viewing fees for <span className="font-semibold text-primary-700 dark:text-[#3EC4B1]">{selectedChild.name}</span>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-[#8E8E93]">
                            {selectedChild.className}{selectedChild.sectionName ? ` - ${selectedChild.sectionName}` : ''}
                            {selectedChild.admissionNumber ? ` | ${selectedChild.admissionNumber}` : ''}
                        </p>
                    </div>
                </div>
            )}

            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 text-gray-900 dark:text-white border-b border-gray-200 dark:border-[#38383A] pb-4">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">{isParent ? `${selectedChild?.name?.split(' ')[0]}'s Fees` : 'My Fees & Payments'}</h1>
                <div className="sm:text-right">
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-[#8E8E93] uppercase font-semibold">Total Outstanding</p>
                    <p className="text-lg sm:text-2xl font-bold text-red-600">{formatCurrency(totalOutstanding)}</p>
                </div>
            </div>

            {/* TABS */}
            <div className="flex border-b border-gray-200 dark:border-[#38383A] gap-4 sm:gap-6 overflow-x-auto overflow-y-hidden whitespace-nowrap">
                <button
                    onClick={() => setActiveTab('invoices')}
                    className={`pb-3 font-medium text-sm transition-colors ${activeTab === 'invoices' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white'}`}
                >
                    <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Invoices
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`pb-3 font-medium text-sm transition-colors ${activeTab === 'history' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white'}`}
                >
                    <div className="flex items-center gap-2">
                        <History className="h-4 w-4" />
                        Payment History
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('receipts')}
                    className={`pb-3 font-medium text-sm transition-colors ${activeTab === 'receipts' ? 'border-b-2 border-primary-600 text-primary-600' : 'text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white'}`}
                >
                    <div className="flex items-center gap-2">
                        <Download className="h-4 w-4" />
                        Receipts
                    </div>
                </button>
            </div>

            {isLoading ? (
                <div className="py-20 flex justify-center"><div className="loading-spinner"></div></div>
            ) : (
                <>
                    {/* INVOICES TAB */}
                    {activeTab === 'invoices' && (
                        <div className="space-y-4 sm:space-y-6 animate-fade-in text-gray-900 dark:text-white">

                            {/* Quick Filter Chips */}
                            {invoices.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        { key: 'Pending', label: 'Pending', color: 'yellow' },
                                        { key: 'Overdue', label: 'Overdue', color: 'red' },
                                        { key: 'Paid', label: 'Paid', color: 'green' },
                                        { key: 'Partial', label: 'Partially Paid', color: 'blue' },
                                    ].filter(c => statusCounts[c.key] > 0).map(chip => {
                                        const isActive = filterStatus === chip.key;
                                        const colorMap = {
                                            yellow: isActive ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800 hover:bg-yellow-100 dark:hover:bg-yellow-500/20',
                                            red: isActive ? 'bg-red-500 text-white border-red-500' : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-500/20',
                                            green: isActive ? 'bg-green-500 text-white border-green-500' : 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-500/20',
                                            blue: isActive ? 'bg-blue-500 text-white border-blue-500' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-500/20',
                                        };
                                        return (
                                            <button
                                                key={chip.key}
                                                onClick={() => setFilterStatus(isActive ? 'all' : chip.key)}
                                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${colorMap[chip.color]}`}
                                            >
                                                {chip.label}
                                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-white/25' : 'bg-black/5 dark:bg-white/10'}`}>
                                                    {statusCounts[chip.key]}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Filter & Sort Bar */}
                            {invoices.length > 0 && (
                                <div className="bg-white dark:bg-[#1C1C1E] rounded-xl border border-gray-200 dark:border-[#38383A] overflow-hidden">
                                    {/* Mobile toggle */}
                                    <button
                                        onClick={() => setShowMobileFilters(!showMobileFilters)}
                                        className="w-full sm:hidden flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300"
                                    >
                                        <span className="flex items-center gap-2">
                                            <SlidersHorizontal className="h-4 w-4" />
                                            Filters & Sort
                                            {hasActiveFilters && (
                                                <span className="w-2 h-2 rounded-full bg-primary-500"></span>
                                            )}
                                        </span>
                                        <ChevronDown className={`h-4 w-4 transition-transform ${showMobileFilters ? 'rotate-180' : ''}`} />
                                    </button>

                                    {/* Filter controls — always visible on desktop, toggleable on mobile */}
                                    <div className={`${showMobileFilters ? 'block' : 'hidden'} sm:block`}>
                                        <div className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-3 flex-wrap">
                                            {/* Quarter */}
                                            <div className="flex items-center gap-2 min-w-0">
                                                <label className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] whitespace-nowrap">Quarter</label>
                                                <select
                                                    value={filterQuarter}
                                                    onChange={(e) => setFilterQuarter(e.target.value)}
                                                    className="flex-1 sm:w-auto text-sm px-3 py-1.5 border border-gray-200 dark:border-[#38383A] rounded-lg bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                                >
                                                    <option value="all">All Quarters</option>
                                                    <option value="1">Q1 (Apr-Jun)</option>
                                                    <option value="2">Q2 (Jul-Sep)</option>
                                                    <option value="3">Q3 (Oct-Dec)</option>
                                                    <option value="4">Q4 (Jan-Mar)</option>
                                                </select>
                                            </div>

                                            {/* Status */}
                                            <div className="flex items-center gap-2 min-w-0">
                                                <label className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] whitespace-nowrap">Status</label>
                                                <select
                                                    value={filterStatus}
                                                    onChange={(e) => setFilterStatus(e.target.value)}
                                                    className="flex-1 sm:w-auto text-sm px-3 py-1.5 border border-gray-200 dark:border-[#38383A] rounded-lg bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                                >
                                                    <option value="all">All Status</option>
                                                    <option value="Pending">Pending</option>
                                                    <option value="Paid">Paid</option>
                                                    <option value="Partial">Partially Paid</option>
                                                    <option value="Overdue">Overdue</option>
                                                </select>
                                            </div>

                                            {/* Year */}
                                            {availableYears.length > 1 && (
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <label className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] whitespace-nowrap">Year</label>
                                                    <select
                                                        value={filterYear}
                                                        onChange={(e) => setFilterYear(e.target.value)}
                                                        className="flex-1 sm:w-auto text-sm px-3 py-1.5 border border-gray-200 dark:border-[#38383A] rounded-lg bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                                    >
                                                        <option value="all">All Years</option>
                                                        {availableYears.map(yr => (
                                                            <option key={yr} value={yr}>{yr}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}

                                            {/* Sort */}
                                            <div className="flex items-center gap-2 min-w-0 sm:ml-auto">
                                                <ArrowUpDown className="h-3.5 w-3.5 text-gray-400 dark:text-[#636366] shrink-0" />
                                                <select
                                                    value={sortBy}
                                                    onChange={(e) => setSortBy(e.target.value)}
                                                    className="flex-1 sm:w-auto text-sm px-3 py-1.5 border border-gray-200 dark:border-[#38383A] rounded-lg bg-white dark:bg-[#2C2C2E] text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                                >
                                                    <option value="due_asc">Due Date (Earliest)</option>
                                                    <option value="due_desc">Due Date (Latest)</option>
                                                    <option value="amount_asc">Amount (Low to High)</option>
                                                    <option value="amount_desc">Amount (High to Low)</option>
                                                </select>
                                            </div>

                                            {/* Clear Filters */}
                                            {hasActiveFilters && (
                                                <button
                                                    onClick={clearFilters}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2C2C2E] rounded-lg transition-colors"
                                                >
                                                    <RotateCcw className="h-3.5 w-3.5" />
                                                    Clear Filters
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Select All / Pay Selected bar */}
                            {filteredPayable.length > 1 && (
                                <div className="flex items-center justify-between bg-white dark:bg-[#1C1C1E] rounded-xl border border-gray-200 dark:border-[#38383A] px-4 py-3">
                                    <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
                                        <input
                                            type="checkbox"
                                            checked={filteredPayable.length > 0 && filteredPayable.every(inv => selectedInvoiceIds.includes(inv._id))}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedInvoiceIds(filteredPayable.map(inv => inv._id));
                                                } else {
                                                    setSelectedInvoiceIds([]);
                                                }
                                            }}
                                            className="rounded border-gray-300 dark:border-[#48484A] text-primary-600 focus:ring-primary-500"
                                        />
                                        Select all unpaid {hasActiveFilters && <span className="text-xs text-gray-400 dark:text-[#636366]">(filtered)</span>}
                                    </label>
                                    {selectedInvoiceIds.length >= 2 && (
                                        <span className="text-xs text-gray-500 dark:text-[#8E8E93]">
                                            {selectedInvoiceIds.length} selected &middot; {formatCurrency(invoices.filter(inv => selectedInvoiceIds.includes(inv._id)).reduce((sum, inv) => sum + (inv.balanceAmount || 0), 0))}
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Invoice count indicator when filtered */}
                            {hasActiveFilters && (
                                <p className="text-xs text-gray-500 dark:text-[#8E8E93]">
                                    Showing {filteredInvoices.length} of {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
                                </p>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                            {invoices.length === 0 && <p className="col-span-full py-10 text-center text-gray-500 dark:text-[#8E8E93]">No invoices have been assigned to you yet.</p>}
                            {invoices.length > 0 && filteredInvoices.length === 0 && (
                                <div className="col-span-full py-10 text-center">
                                    <Filter className="h-8 w-8 mx-auto mb-2 text-gray-300 dark:text-[#48484A]" />
                                    <p className="text-sm text-gray-500 dark:text-[#8E8E93]">No invoices match your filters</p>
                                    <button onClick={clearFilters} className="mt-2 text-xs text-primary-600 dark:text-primary-400 hover:underline">Clear all filters</button>
                                </div>
                            )}

                            {filteredInvoices.map(invoice => {
                                const isPayable = invoice.balanceAmount > 0 && invoice.status !== 'Paid';
                                const isSelected = selectedInvoiceIds.includes(invoice._id);
                                return (
                                <div key={invoice._id} className={`bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border overflow-hidden hover:shadow-md transition-all ${isSelected ? 'border-primary-400 dark:border-primary-600 ring-2 ring-primary-200 dark:ring-primary-800' : 'border-gray-200 dark:border-[#38383A]'}`}>
                                    {invoice.billingPeriod?.displayText && (
                                        <div className={`px-4 sm:px-5 py-2.5 border-b flex items-center justify-between ${isSelected ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-200 dark:border-primary-800/30' : 'bg-primary-50 dark:bg-primary-900/20 border-primary-100 dark:border-primary-800/30'}`}>
                                            <span className="text-sm font-bold text-primary-700 dark:text-primary-400">{invoice.billingPeriod.displayText}</span>
                                            {isPayable && (
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleInvoiceSelection(invoice._id)}
                                                    className="rounded border-gray-300 dark:border-[#48484A] text-primary-600 focus:ring-primary-500 cursor-pointer"
                                                />
                                            )}
                                        </div>
                                    )}
                                    {!invoice.billingPeriod?.displayText && isPayable && (
                                        <div className="px-4 sm:px-5 py-2 border-b border-gray-100 dark:border-[#38383A] flex justify-end">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleInvoiceSelection(invoice._id)}
                                                className="rounded border-gray-300 dark:border-[#48484A] text-primary-600 focus:ring-primary-500 cursor-pointer"
                                            />
                                        </div>
                                    )}
                                    <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-[#38383A] flex justify-between items-start">
                                        <div>
                                            <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{invoice.invoiceNumber}</h3>
                                            <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Due: {formatDate(invoice.dueDate)}</p>
                                        </div>
                                        <StatusBadge status={invoice.status} />
                                    </div>
                                    <div className="p-4 sm:p-5 bg-gray-50 dark:bg-[#2C2C2E] space-y-3 sm:space-y-4">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-gray-600 dark:text-[#8E8E93]">Total Amount</span>
                                            <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(invoice.totalAmount)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-gray-600 dark:text-[#8E8E93]">Paid</span>
                                            <span className="font-medium text-green-600">{formatCurrency(invoice.paidAmount)}</span>
                                        </div>
                                        {invoice.discount && invoice.discount.amount > 0 && (
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-green-600">Discount</span>
                                                <span className="font-medium text-green-600">-{formatCurrency(invoice.discount.amount)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between items-center text-base font-bold pt-2 border-t border-gray-200 dark:border-[#38383A]">
                                            <span>Balance</span>
                                            <span className={invoice.balanceAmount > 0 ? "text-red-600" : "text-gray-900 dark:text-white"}>{formatCurrency(invoice.balanceAmount)}</span>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-white dark:bg-[#1C1C1E] flex gap-2">
                                        <button
                                            onClick={() => setSelectedInvoice(invoice)}
                                            className="flex-1 btn btn-outline border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-500/10 hover:border-primary-300 dark:hover:border-primary-700"
                                        >
                                            View Details
                                        </button>
                                        {(() => {
                                            if (invoice.balanceAmount <= 0) return null;
                                            const stuck = history.find(h => h.invoiceId?._id === invoice._id && ['PENDING', 'PROCESSING', 'INITIATED'].includes(h.status));
                                            const underReview = history.some(h => h.invoiceId?._id === invoice._id && h.status === 'UNDER_REVIEW');
                                            if (underReview) return null; // genuine admin review — don't allow retry
                                            if (stuck && PAYMENT_GATEWAY_ENABLED) {
                                                return (
                                                    <button
                                                        onClick={() => handleAbandonAndRetry(invoice._id)}
                                                        disabled={isGatewayPaying || isAbandoning}
                                                        className="flex-1 btn bg-amber-600 text-white hover:bg-amber-500 shadow-sm hover:shadow active:scale-95 flex items-center justify-center gap-2"
                                                        title="Cancel the previous payment attempt and start over"
                                                    >
                                                        {(isGatewayPaying || isAbandoning) ? (
                                                            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Retrying...</>
                                                        ) : (
                                                            <><CreditCard className="h-4 w-4" /> Cancel & Retry</>
                                                        )}
                                                    </button>
                                                );
                                            }
                                            return (
                                                <button
                                                    onClick={() => PAYMENT_GATEWAY_ENABLED ? handleGatewayPayment(invoice._id) : openPaymentForm(invoice)}
                                                    disabled={isGatewayPaying}
                                                    className="flex-1 btn bg-primary-600 text-white hover:bg-primary-500 shadow-sm hover:shadow active:scale-95 flex items-center justify-center gap-2"
                                                >
                                                    {isGatewayPaying ? (
                                                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Connecting...</>
                                                    ) : (
                                                        <><CreditCard className="h-4 w-4" /> Pay Now</>
                                                    )}
                                                </button>
                                            );
                                        })()}
                                    </div>
                                </div>
                                );
                            })}
                            </div>

                            {/* Sticky Pay Selected bar */}
                            {selectedInvoiceIds.length >= 2 && (
                                <div className="sticky bottom-0 z-10 bg-white dark:bg-[#1C1C1E] border-t border-gray-200 dark:border-[#38383A] rounded-xl shadow-lg p-4 flex items-center justify-between gap-3 mt-4">
                                    <div>
                                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                            {selectedInvoiceIds.length} invoices selected
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-[#8E8E93]">
                                            Total: {formatCurrency(invoices.filter(inv => selectedInvoiceIds.includes(inv._id)).reduce((sum, inv) => sum + (inv.balanceAmount || 0), 0))}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setSelectedInvoiceIds([])}
                                            className="btn btn-outline text-sm px-4 py-2"
                                        >
                                            Clear
                                        </button>
                                        <button
                                            onClick={() => PAYMENT_GATEWAY_ENABLED ? handleCombinedPayment() : handleCombinedManualPayment()}
                                            disabled={isGatewayPaying}
                                            className="btn bg-primary-600 text-white hover:bg-primary-500 shadow-sm text-sm px-5 py-2 flex items-center gap-2 active:scale-95"
                                        >
                                            {isGatewayPaying ? (
                                                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Connecting...</>
                                            ) : (
                                                <><CreditCard className="h-4 w-4" /> Pay {selectedInvoiceIds.length} Invoices</>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* HISTORY TAB */}
                    {activeTab === 'history' && (
                        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-200 dark:border-[#38383A] overflow-hidden animate-fade-in text-gray-900 dark:text-white">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-gray-50 dark:bg-[#2C2C2E] text-gray-600 dark:text-[#8E8E93] font-medium border-b border-gray-200 dark:border-[#38383A]">
                                        <tr>
                                            <th className="px-6 py-4">Date</th>
                                            <th className="px-6 py-4">Invoice</th>
                                            <th className="px-6 py-4">Amount</th>
                                            <th className="px-6 py-4">Gateway Ref</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-[#38383A]">
                                        {history.length === 0 && (
                                            <tr><td colSpan="6" className="px-6 py-10 text-center text-gray-500 dark:text-[#8E8E93]">No payment attempts found.</td></tr>
                                        )}
                                        {history.map(attempt => (
                                            <tr key={attempt._id} className="hover:bg-gray-50/50 dark:hover:bg-[#2C2C2E]">
                                                <td className="px-6 py-4">{formatDate(attempt.createdAt, true)}</td>
                                                <td className="px-6 py-4 font-mono text-xs">{attempt.invoiceId?.invoiceNumber}</td>
                                                <td className="px-6 py-4 font-medium">{formatCurrency(attempt.amount)}</td>
                                                <td className="px-6 py-4 font-mono text-xs text-gray-500 dark:text-[#8E8E93]">{attempt.gatewayRefId || 'Pending Generation'}</td>
                                                <td className="px-6 py-4"><AttemptStatusBadge status={attempt.status} /></td>
                                                <td className="px-6 py-4 text-right">
                                                    {['PENDING', 'PROCESSING', 'INITIATED', 'UNDER_REVIEW'].includes(attempt.status) && (
                                                        <div className="flex items-center justify-end gap-2">
                                                            <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-[#636366]">
                                                                <Lock className="h-3 w-3" />
                                                                {attempt.status === 'UNDER_REVIEW' ? 'Awaiting admin verification' : 'Pending at gateway'}
                                                            </span>
                                                            {['INITIATED', 'PROCESSING', 'PENDING'].includes(attempt.status) && attempt.invoiceId?._id && (
                                                                <button
                                                                    onClick={() => handleAbandonAndRetry(attempt.invoiceId._id)}
                                                                    disabled={isGatewayPaying || isAbandoning}
                                                                    className="px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 rounded disabled:opacity-50"
                                                                    title="Cancel this attempt and try paying again"
                                                                >
                                                                    Cancel & Retry
                                                                </button>
                                                            )}
                                                            <button onClick={() => setDisputeModal({ isOpen: true, attemptId: attempt._id, invoiceId: attempt.invoiceId?._id })} className="p-1.5 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded" title="Report Issue">
                                                                <AlertTriangle className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    )}
                                                    {['SUCCESS', 'VERIFIED'].includes(attempt.status) && (
                                                        <div className="flex items-center gap-1.5">
                                                            <button onClick={() => handleViewReceipt(attempt)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-lg transition-colors" title="View Receipt">
                                                                <Eye className="h-3.5 w-3.5" />
                                                                View
                                                            </button>
                                                            <button onClick={() => handleDownloadReceipt(attempt)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-500/10 hover:bg-green-100 dark:hover:bg-green-500/20 rounded-lg transition-colors" title="Download PDF">
                                                                <Download className="h-3.5 w-3.5" />
                                                                PDF
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* RECEIPTS TAB */}
                    {activeTab === 'receipts' && (
                        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-200 dark:border-[#38383A] overflow-hidden animate-fade-in text-gray-900 dark:text-white">
                            {receiptsLoading ? (
                                <div className="py-16 text-center"><div className="loading-spinner"></div></div>
                            ) : receipts.length === 0 ? (
                                <div className="py-16 text-center text-gray-500 dark:text-[#8E8E93]">
                                    <Download className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">No receipts yet</p>
                                    <p className="text-xs mt-1 opacity-60">Receipts will appear here once your payments are verified.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100 dark:divide-[#38383A]">
                                    {receipts.map(receipt => (
                                        <div key={receipt._id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/50 dark:hover:bg-[#2C2C2E] transition-colors">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-green-50 dark:bg-green-500/10 flex items-center justify-center">
                                                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                                        Receipt #{receipt.receiptNumber}
                                                    </p>
                                                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-0.5">
                                                        {receipt.invoiceId?.invoiceNumber || 'Invoice'} &middot; {formatDate(receipt.paymentDate || receipt.issuedAt)}
                                                        {receipt.initiatedBy === 'admin' && (
                                                            <span className="ml-1.5 text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-1.5 py-0.5 rounded">
                                                                Recorded by Admin
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 sm:gap-4">
                                                <span className="text-base font-bold text-gray-900 dark:text-white">
                                                    {formatCurrency(receipt.amount || receipt.paymentAttemptId?.amount || 0)}
                                                </span>
                                                <button
                                                    onClick={() => handleViewReceipt({ _id: receipt._id })}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 dark:hover:bg-blue-500/20 rounded-lg transition-colors"
                                                >
                                                    <Eye className="h-3.5 w-3.5" />
                                                    View
                                                </button>
                                                <button
                                                    onClick={() => handleDownloadReceipt({ _id: receipt._id })}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-500/10 hover:bg-green-100 dark:hover:bg-green-500/20 rounded-lg transition-colors"
                                                >
                                                    <Download className="h-3.5 w-3.5" />
                                                    PDF
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* INVOICE DETAIL MODAL */}
            {selectedInvoice && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in text-gray-900 dark:text-white">
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-[#38383A] flex justify-between items-center bg-gray-50 dark:bg-[#2C2C2E]">
                            <div>
                                <h2 className="text-lg sm:text-xl font-bold">Invoice Details</h2>
                                <p className="text-sm text-gray-500 dark:text-[#8E8E93] font-mono mt-1">{selectedInvoice.invoiceNumber}</p>
                            </div>
                            <button onClick={() => setSelectedInvoice(null)} className="p-2 hover:bg-gray-200 dark:hover:bg-[#2C2C2E] rounded-full transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 sm:space-y-6">
                            {/* Breakdown */}
                            <div>
                                <h3 className="text-sm font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider mb-3">Fee Breakdown</h3>
                                <div className="space-y-2">
                                    {selectedInvoice.items?.map((item, idx) => (
                                        <div key={idx} className="flex justify-between py-2 border-b border-gray-100 dark:border-[#38383A] border-dashed text-sm">
                                            <span className="text-gray-700 dark:text-[#8E8E93]">{item.feeHeadName} <span className="text-xs text-gray-400 dark:text-[#636366]">({item.frequency})</span></span>
                                            <span className="font-medium">{formatCurrency(item.amount)}</span>
                                        </div>
                                    ))}
                                    {/* Discount applied */}
                                    {selectedInvoice.discount && selectedInvoice.discount.amount > 0 && (
                                        <div className="flex justify-between py-2 border-b border-green-100 dark:border-green-800 border-dashed text-sm text-green-600 dark:text-green-400">
                                            <span className="flex items-center gap-1">
                                                <span>Discount</span>
                                                <span className="text-xs text-green-500 dark:text-green-400 bg-green-50 dark:bg-green-500/10 px-1.5 py-0.5 rounded">
                                                    {selectedInvoice.discount.type || 'Applied'}
                                                </span>
                                            </span>
                                            <span className="font-medium">-{formatCurrency(selectedInvoice.discount.amount)}</span>
                                        </div>
                                    )}
                                    {selectedInvoice.lateFeeApplied > 0 && (
                                        <div className="flex justify-between py-2 border-b border-red-100 dark:border-red-800 border-dashed text-sm text-red-600 dark:text-red-400">
                                            <span>Late Fee</span>
                                            <span className="font-medium">{formatCurrency(selectedInvoice.lateFeeApplied)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Pending verification warning */}
                            {(() => {
                                const stuck = history.find(h => h.invoiceId?._id === selectedInvoice._id && ['PENDING', 'PROCESSING', 'INITIATED'].includes(h.status));
                                const underReview = history.some(h => h.invoiceId?._id === selectedInvoice._id && h.status === 'UNDER_REVIEW');
                                if (underReview) {
                                    return (
                                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-xl flex items-start gap-3">
                                            <ShieldCheck className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                                            <div>
                                                <h4 className="text-sm font-bold text-yellow-800 dark:text-yellow-300">Payment Pending Verification</h4>
                                                <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                                                    You have a payment submission awaiting admin verification. You'll be notified once it's approved or if any action is needed.
                                                </p>
                                            </div>
                                        </div>
                                    );
                                }
                                if (stuck && PAYMENT_GATEWAY_ENABLED) {
                                    return (
                                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-xl flex items-start gap-3">
                                            <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                            <div className="flex-1">
                                                <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300">Previous payment didn't complete</h4>
                                                <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                                                    Looks like your last payment attempt was cancelled or didn't finish. You can cancel it and try again.
                                                </p>
                                                <button
                                                    onClick={() => handleAbandonAndRetry(selectedInvoice._id)}
                                                    disabled={isGatewayPaying || isAbandoning}
                                                    className="mt-3 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg disabled:opacity-50"
                                                >
                                                    {(isGatewayPaying || isAbandoning) ? (
                                                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Retrying...</>
                                                    ) : (
                                                        <><CreditCard className="h-4 w-4" /> Cancel & Retry Payment</>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                        </div>

                        {/* Footer / Actions */}
                        <div className="p-4 sm:p-6 border-t border-gray-100 dark:border-[#38383A] bg-gray-50 dark:bg-[#2C2C2E] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                            <div className="text-left">
                                <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Amount Due</p>
                                <p className="text-xl sm:text-2xl font-bold">{formatCurrency(selectedInvoice.balanceAmount)}</p>
                            </div>

                            {(() => {
                                const stuck = history.find(h => h.invoiceId?._id === selectedInvoice._id && ['PENDING', 'PROCESSING', 'INITIATED'].includes(h.status));
                                const underReview = history.some(h => h.invoiceId?._id === selectedInvoice._id && h.status === 'UNDER_REVIEW');
                                const fullyPaid = selectedInvoice.balanceAmount <= 0;
                                const blocked = fullyPaid || underReview;
                                const onClick = () => {
                                    if (blocked) return;
                                    if (stuck && PAYMENT_GATEWAY_ENABLED) return handleAbandonAndRetry(selectedInvoice._id);
                                    return PAYMENT_GATEWAY_ENABLED ? handleGatewayPayment(selectedInvoice._id) : openPaymentForm(selectedInvoice);
                                };
                                return (
                                    <button
                                        onClick={onClick}
                                        disabled={isGatewayPaying || isAbandoning || blocked}
                                        className={`w-full sm:w-auto justify-center px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all ${blocked
                                                ? 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-400 dark:text-[#636366] cursor-not-allowed'
                                                : stuck
                                                    ? 'bg-amber-600 text-white hover:bg-amber-500 shadow-sm hover:shadow active:scale-95'
                                                    : 'bg-primary-600 text-white hover:bg-primary-500 shadow-sm hover:shadow active:scale-95'
                                            }`}
                                    >
                                        {(isGatewayPaying || isAbandoning) ? (
                                            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> {stuck ? 'Retrying...' : 'Connecting...'}</>
                                        ) : fullyPaid ? (
                                            <><CheckCircle className="h-5 w-5" /> Fully Paid</>
                                        ) : underReview ? (
                                            <><ShieldCheck className="h-5 w-5" /> Awaiting Verification</>
                                        ) : stuck && PAYMENT_GATEWAY_ENABLED ? (
                                            <><CreditCard className="h-5 w-5" /> Cancel & Retry</>
                                        ) : PAYMENT_GATEWAY_ENABLED ? (
                                            <><CreditCard className="h-5 w-5" /> Pay Securely</>
                                        ) : (
                                            <><CreditCard className="h-5 w-5" /> Submit Payment</>
                                        )}
                                    </button>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* DISPUTE MODAL */}
            {disputeModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in text-gray-900 dark:text-white">
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md overflow-hidden">
                        <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-[#38383A] flex justify-between items-center">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-orange-500" />
                                File a Dispute
                            </h2>
                            <button onClick={() => setDisputeModal({ isOpen: false })} className="p-2 hover:bg-gray-200 dark:hover:bg-[#2C2C2E] rounded-full">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={submitDispute} className="p-4 sm:p-6 space-y-4">
                            <p className="text-sm text-gray-600 dark:text-[#8E8E93] mb-4">
                                If money was deducted from your bank but your receipt was not generated, please provide the details below. Our admin team will verify it.
                            </p>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Transaction ID / UTR *</label>
                                <input
                                    type="text" required
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-[#38383A] rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-shadow bg-white dark:bg-[#1C1C1E] dark:text-white dark:placeholder-[#636366]"
                                    placeholder="e.g. UPI Ref 1234567890"
                                    value={disputeForm.transactionId}
                                    onChange={(e) => setDisputeForm({ ...disputeForm, transactionId: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Amount Deducted (*) *</label>
                                <input
                                    type="number" required min="1"
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-[#38383A] rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-shadow bg-white dark:bg-[#1C1C1E] dark:text-white dark:placeholder-[#636366]"
                                    placeholder="5000"
                                    value={disputeForm.amount}
                                    onChange={(e) => setDisputeForm({ ...disputeForm, amount: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Explanation *</label>
                                <textarea
                                    required rows="3"
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-[#38383A] rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-shadow bg-white dark:bg-[#1C1C1E] dark:text-white dark:placeholder-[#636366]"
                                    placeholder="Describe what happened..."
                                    value={disputeForm.studentNote}
                                    onChange={(e) => setDisputeForm({ ...disputeForm, studentNote: e.target.value })}
                                ></textarea>
                            </div>

                            <div className="pt-4 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
                                <button type="button" onClick={() => setDisputeModal({ isOpen: false })} className="w-full sm:w-auto px-4 py-2 font-medium text-gray-600 dark:text-[#8E8E93] hover:bg-gray-100 dark:hover:bg-[#2C2C2E] rounded-xl">
                                    Cancel
                                </button>
                                <button type="submit" disabled={submitDisputeMutation.isPending} className="w-full sm:w-auto px-6 py-2 font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-2xl shadow-glass disabled:opacity-50">
                                    {submitDisputeMutation.isPending ? 'Submitting...' : 'Submit Dispute'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MANUAL PAYMENT FORM MODAL */}
            {paymentModal.isOpen && (paymentModal.invoice || paymentModal.combinedInvoiceIds) && (() => {
                const isCombined = !!paymentModal.combinedInvoiceIds;
                const maxAmount = isCombined
                    ? paymentModal.combinedTotal
                    : paymentModal.invoice?.balanceAmount || 0;
                const subtitle = isCombined
                    ? `${paymentModal.combinedInvoiceIds.length} invoices · Total: ${formatCurrency(maxAmount)}`
                    : `Invoice: ${paymentModal.invoice?.invoiceNumber} · Balance: ${formatCurrency(maxAmount)}`;
                return (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in text-gray-900 dark:text-white">
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-md overflow-hidden">
                        <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-[#38383A] flex justify-between items-center bg-white dark:bg-[#1C1C1E]">
                            <div>
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <IndianRupee className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                                    {isCombined ? 'Combined Payment Proof' : 'Submit Payment Proof'}
                                </h2>
                                <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-1">{subtitle}</p>
                            </div>
                            <button onClick={() => setPaymentModal({ isOpen: false, invoice: null })} className="p-2 hover:bg-gray-200 dark:hover:bg-[#2C2C2E] rounded-full transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmitPayment} className="p-4 sm:p-6 space-y-4">
                            {isCombined && (
                                <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-3 space-y-1">
                                    {invoices.filter(inv => paymentModal.combinedInvoiceIds.includes(inv._id)).map(inv => (
                                        <div key={inv._id} className="flex justify-between text-xs">
                                            <span className="text-gray-700 dark:text-gray-300">{inv.billingPeriod?.displayText || inv.invoiceNumber}</span>
                                            <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(inv.balanceAmount)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Payment Mode *</label>
                                <select
                                    required
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-[#38383A] rounded-xl focus:ring-2 focus:ring-primary-500 outline-none bg-white dark:bg-[#1C1C1E] dark:text-white"
                                    value={paymentForm.paymentMode}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })}
                                >
                                    <option value="">Select mode...</option>
                                    <option value="UPI">UPI</option>
                                    <option value="BANK_TRANSFER">Bank Transfer / NEFT / IMPS</option>
                                    <option value="CASH">Cash</option>
                                    <option value="CHEQUE">Cheque</option>
                                    <option value="OTHER">Other</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                                    Transaction ID / Reference Number {paymentForm.paymentMode !== 'CASH' && '*'}
                                </label>
                                <input
                                    type="text"
                                    required={paymentForm.paymentMode !== 'CASH'}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-[#38383A] rounded-xl focus:ring-2 focus:ring-primary-500 outline-none bg-white dark:bg-[#1C1C1E] dark:text-white dark:placeholder-[#636366]"
                                    placeholder="e.g. UPI Ref 1234567890"
                                    value={paymentForm.transactionRefId}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, transactionRefId: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Amount Paid *</label>
                                <input
                                    type="number" required min="1" max={maxAmount}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-[#38383A] rounded-xl focus:ring-2 focus:ring-primary-500 outline-none bg-white dark:bg-[#1C1C1E] dark:text-white dark:placeholder-[#636366]"
                                    placeholder={String(maxAmount)}
                                    value={paymentForm.amount}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Date of Payment *</label>
                                <input
                                    type="date" required
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-[#38383A] rounded-xl focus:ring-2 focus:ring-primary-500 outline-none bg-white dark:bg-[#1C1C1E] dark:text-white"
                                    value={paymentForm.paymentDate}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                                />
                            </div>

                            <p className="text-xs text-gray-400 dark:text-[#636366] leading-relaxed">
                                After submission, your payment will be reviewed by the admin team. You'll be notified once it's verified.
                            </p>

                            <div className="pt-2 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3">
                                <button type="button" onClick={() => setPaymentModal({ isOpen: false, invoice: null })} className="w-full sm:w-auto px-4 py-2 font-medium text-gray-600 dark:text-[#8E8E93] hover:bg-gray-100 dark:hover:bg-[#2C2C2E] rounded-xl">
                                    Cancel
                                </button>
                                <button type="submit" disabled={submitPaymentMutation.isPending} className="w-full sm:w-auto px-6 py-2.5 font-semibold text-white bg-primary-600 hover:bg-primary-500 rounded-2xl shadow-glass disabled:opacity-50 flex items-center justify-center gap-2">
                                    {submitPaymentMutation.isPending ? (
                                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Submitting...</>
                                    ) : (
                                        <><Upload className="h-4 w-4" /> Submit for Verification</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
                );
            })()}

            {/* PAYMENT CONFIRMATION SCREEN */}
            {paymentConfirmation && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in text-gray-900 dark:text-white">
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-sm overflow-hidden text-center p-6 sm:p-8">
                        <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center mb-4">
                            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Payment Submitted</h2>
                        <p className="text-sm text-gray-600 dark:text-[#8E8E93] leading-relaxed">
                            Your payment has been submitted for verification. You'll be notified once it's approved.
                        </p>
                        <button
                            onClick={() => { setPaymentConfirmation(false); setActiveTab('history'); }}
                            className="mt-6 w-full px-6 py-2.5 font-semibold text-white bg-primary-600 hover:bg-primary-500 rounded-2xl shadow-glass"
                        >
                            View Payment History
                        </button>
                    </div>
                </div>
            )}

        </div>
    );
};

// Small helper UI components
const StatusBadge = ({ status }) => {
    const map = {
        'Paid': 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
        'Partial': 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
        'Pending': 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
        'Overdue': 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
    };
    return (
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${map[status] || 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-700 dark:text-[#8E8E93] border-gray-200 dark:border-[#38383A]'}`}>
            {status}
        </span>
    );
};

const AttemptStatusBadge = ({ status }) => {
    const config = {
        'SUCCESS': { classes: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800', label: 'Verified' },
        'VERIFIED': { classes: 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800', label: 'Verified' },
        'FAILED': { classes: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800', label: 'Failed' },
        'PENDING': { classes: 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800', label: 'Pending Verification' },
        'PROCESSING': { classes: 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800', label: 'Pending Verification' },
        'UNDER_REVIEW': { classes: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800', label: 'Under Review' },
        'DISPUTED': { classes: 'bg-orange-100 dark:bg-orange-500/20 text-orange-800 dark:text-orange-400 border-orange-200 dark:border-orange-800', label: 'Disputed' },
        'INITIATED': { classes: 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800', label: 'Pending Verification' },
    };
    const { classes, label } = config[status] || { classes: 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-700 dark:text-[#8E8E93] border-gray-200 dark:border-[#38383A]', label: status };
    return (
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${classes}`}>
            {label}
        </span>
    );
};

export default StudentFeesDashboard;
