import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, History, AlertTriangle, FileText, CheckCircle, Clock, X, ExternalLink, Download, Lock, ShieldCheck, Upload, IndianRupee } from 'lucide-react';
import toast from 'react-hot-toast';
import { studentFeesService } from '../../services/studentFeesService';
import { formatCurrency } from '../../utils/formatCurrency';
import { buildReceiptHtml, downloadReceiptAsPdf } from '../../utils/receiptHelpers';
import { useSettings } from '../../contexts/SettingsContext';

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
        queryKey: ['student-invoices'],
        queryFn: async () => {
            const res = await studentFeesService.getInvoices();
            return res.data?.data || [];
        },
    });

    const { data: history = [], isLoading: historyLoading } = useQuery({
        queryKey: ['student-payment-history'],
        queryFn: async () => {
            const res = await studentFeesService.getHistory();
            return res.data?.data || [];
        },
    });

    const { data: receipts = [], isLoading: receiptsLoading } = useQuery({
        queryKey: ['student-receipts'],
        queryFn: async () => {
            const res = await studentFeesService.getReceipts();
            return res.data?.data || [];
        },
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
        try {
            toast.loading('Generating receipt...', { id: 'receipt' });
            const res = await studentFeesService.getReceipt(attempt._id);
            const payment = res.data?.data || res.data;

            if (!payment) {
                toast.error('Receipt data not available', { id: 'receipt' });
                return;
            }

            const school = schoolSettings || {};
            await downloadReceiptAsPdf(payment, school);
            toast.success('Receipt downloaded', { id: 'receipt' });
        } catch (e) {
            toast.error('Receipt unavailable', { id: 'receipt' });
        }
    }

    const totalOutstanding = invoices.reduce((sum, inv) => sum + (inv.balanceAmount || 0), 0);

    return (
        <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 text-gray-900 dark:text-white border-b border-gray-200 dark:border-[#38383A] pb-4">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">My Fees & Payments</h1>
                <div className="sm:text-right">
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-[#8E8E93] uppercase font-semibold">Total Outstanding</p>
                    <p className="text-lg sm:text-2xl font-bold text-red-600">{formatCurrency(totalOutstanding)}</p>
                </div>
            </div>

            {/* TABS */}
            <div className="flex border-b border-gray-200 dark:border-[#38383A] gap-4 sm:gap-6 overflow-x-auto whitespace-nowrap">
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
                            {/* Select All / Pay Selected bar */}
                            {invoices.filter(inv => inv.balanceAmount > 0 && inv.status !== 'Paid').length > 1 && (
                                <div className="flex items-center justify-between bg-white dark:bg-[#1C1C1E] rounded-xl border border-gray-200 dark:border-[#38383A] px-4 py-3">
                                    <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 dark:text-gray-300">
                                        <input
                                            type="checkbox"
                                            checked={selectedInvoiceIds.length === invoices.filter(inv => inv.balanceAmount > 0 && inv.status !== 'Paid').length && selectedInvoiceIds.length > 0}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedInvoiceIds(invoices.filter(inv => inv.balanceAmount > 0 && inv.status !== 'Paid').map(inv => inv._id));
                                                } else {
                                                    setSelectedInvoiceIds([]);
                                                }
                                            }}
                                            className="rounded border-gray-300 dark:border-[#48484A] text-primary-600 focus:ring-primary-500"
                                        />
                                        Select all unpaid
                                    </label>
                                    {selectedInvoiceIds.length >= 2 && (
                                        <span className="text-xs text-gray-500 dark:text-[#8E8E93]">
                                            {selectedInvoiceIds.length} selected &middot; {formatCurrency(invoices.filter(inv => selectedInvoiceIds.includes(inv._id)).reduce((sum, inv) => sum + (inv.balanceAmount || 0), 0))}
                                        </span>
                                    )}
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                            {invoices.length === 0 && <p className="col-span-full py-10 text-center text-gray-500 dark:text-[#8E8E93]">No invoices have been assigned to you yet.</p>}

                            {invoices.map(invoice => {
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
                                        {invoice.balanceAmount > 0 && !history.some(h => h.invoiceId?._id === invoice._id && ['PENDING', 'PROCESSING', 'INITIATED', 'UNDER_REVIEW'].includes(h.status)) && (
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
                                        )}
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
                                                                Awaiting admin verification
                                                            </span>
                                                            <button onClick={() => setDisputeModal({ isOpen: true, attemptId: attempt._id, invoiceId: attempt.invoiceId?._id })} className="p-1.5 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded" title="Report Issue">
                                                                <AlertTriangle className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    )}
                                                    {['SUCCESS', 'VERIFIED'].includes(attempt.status) && (
                                                        <button onClick={() => handleDownloadReceipt(attempt)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-500/10 hover:bg-green-100 dark:hover:bg-green-500/20 rounded-lg transition-colors" title="Download Receipt">
                                                            <Download className="h-3.5 w-3.5" />
                                                            Receipt
                                                        </button>
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
                                                    onClick={() => handleDownloadReceipt({ _id: receipt.paymentAttemptId?._id || receipt._id })}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-500/10 hover:bg-green-100 dark:hover:bg-green-500/20 rounded-lg transition-colors"
                                                >
                                                    <Download className="h-3.5 w-3.5" />
                                                    Download
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
                            {history.some(h => h.invoiceId?._id === selectedInvoice._id && ['PENDING', 'PROCESSING', 'INITIATED', 'UNDER_REVIEW'].includes(h.status)) && (
                                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-xl flex items-start gap-3">
                                    <ShieldCheck className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-sm font-bold text-yellow-800 dark:text-yellow-300">Payment Pending Verification</h4>
                                        <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                                            You have a payment submission awaiting admin verification. You'll be notified once it's approved or if any action is needed.
                                        </p>
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* Footer / Actions */}
                        <div className="p-4 sm:p-6 border-t border-gray-100 dark:border-[#38383A] bg-gray-50 dark:bg-[#2C2C2E] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                            <div className="text-left">
                                <p className="text-xs text-gray-500 dark:text-[#8E8E93]">Amount Due</p>
                                <p className="text-xl sm:text-2xl font-bold">{formatCurrency(selectedInvoice.balanceAmount)}</p>
                            </div>

                            <button
                                onClick={() => PAYMENT_GATEWAY_ENABLED ? handleGatewayPayment(selectedInvoice._id) : openPaymentForm(selectedInvoice)}
                                disabled={isGatewayPaying || selectedInvoice.balanceAmount <= 0 || history.some(h => h.invoiceId?._id === selectedInvoice._id && ['PENDING', 'PROCESSING', 'INITIATED', 'UNDER_REVIEW'].includes(h.status))}
                                className={`w-full sm:w-auto justify-center px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all ${selectedInvoice.balanceAmount <= 0
                                        ? 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-400 dark:text-[#636366] cursor-not-allowed'
                                        : 'bg-primary-600 text-white hover:bg-primary-500 shadow-sm hover:shadow active:scale-95'
                                    }`}
                            >
                                {isGatewayPaying ? (
                                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Connecting...</>
                                ) : selectedInvoice.balanceAmount <= 0 ? (
                                    <><CheckCircle className="h-5 w-5" /> Fully Paid</>
                                ) : PAYMENT_GATEWAY_ENABLED ? (
                                    <><CreditCard className="h-5 w-5" /> Pay Securely</>
                                ) : (
                                    <><CreditCard className="h-5 w-5" /> Submit Payment</>
                                )}
                            </button>
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
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-[#38383A] rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-shadow dark:bg-[#1C1C1E] dark:text-white dark:placeholder-[#636366]"
                                    placeholder="e.g. UPI Ref 1234567890"
                                    value={disputeForm.transactionId}
                                    onChange={(e) => setDisputeForm({ ...disputeForm, transactionId: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Amount Deducted (*) *</label>
                                <input
                                    type="number" required min="1"
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-[#38383A] rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-shadow dark:bg-[#1C1C1E] dark:text-white dark:placeholder-[#636366]"
                                    placeholder="5000"
                                    value={disputeForm.amount}
                                    onChange={(e) => setDisputeForm({ ...disputeForm, amount: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Explanation *</label>
                                <textarea
                                    required rows="3"
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-[#38383A] rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition-shadow dark:bg-[#1C1C1E] dark:text-white dark:placeholder-[#636366]"
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
                        <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-[#38383A] flex justify-between items-center bg-gray-50 dark:bg-[#2C2C2E]">
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
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-[#38383A] rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:bg-[#1C1C1E] dark:text-white"
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
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-[#38383A] rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:bg-[#1C1C1E] dark:text-white dark:placeholder-[#636366]"
                                    placeholder="e.g. UPI Ref 1234567890"
                                    value={paymentForm.transactionRefId}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, transactionRefId: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Amount Paid *</label>
                                <input
                                    type="number" required min="1" max={maxAmount}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-[#38383A] rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:bg-[#1C1C1E] dark:text-white dark:placeholder-[#636366]"
                                    placeholder={String(maxAmount)}
                                    value={paymentForm.amount}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Date of Payment *</label>
                                <input
                                    type="date" required
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-[#38383A] rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:bg-[#1C1C1E] dark:text-white"
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
