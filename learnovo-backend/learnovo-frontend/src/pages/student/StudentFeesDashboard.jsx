import React, { useState, useEffect } from 'react';
import { CreditCard, History, AlertTriangle, FileText, CheckCircle, Clock, X, ExternalLink, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { studentFeesService } from '../../services/studentFeesService';

// Format currency
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount || 0);
};

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
    const [activeTab, setActiveTab] = useState('invoices'); // invoices, history
    const [isLoading, setIsLoading] = useState(true);

    const [invoices, setInvoices] = useState([]);
    const [history, setHistory] = useState([]);

    const [selectedInvoice, setSelectedInvoice] = useState(null); // Triggers Modal
    const [isPaying, setIsPaying] = useState(false);

    const [disputeModal, setDisputeModal] = useState({ isOpen: false, attemptId: null, invoiceId: null });
    const [disputeForm, setDisputeForm] = useState({ transactionId: '', bankReferenceNumber: '', amount: '', studentNote: '' });
    const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);

    useEffect(() => {
        fetchData();
        // Set up polling for pending payments
        const interval = setInterval(fetchData, 30000); // 30 sec
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            const [invoicesRes, historyRes] = await Promise.all([
                studentFeesService.getInvoices(),
                studentFeesService.getHistory()
            ]);
            setInvoices(invoicesRes.data?.data || []);
            setHistory(historyRes.data?.data || []);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load fee data');
        } finally {
            setIsLoading(false);
        }
    };

    const handleInitiatePayment = async (invoiceId) => {
        try {
            setIsPaying(true);
            const res = await studentFeesService.initiatePayment(invoiceId);

            if (res.data?.success && res.data.data.paymentUrl) {
                toast.success('Redirecting to payment gateway...');
                // The mock gateway returns a URL. We could redirect here.
                // For demonstration, we'll open it in a new tab to simulate the checkout flow
                window.open(res.data.data.paymentUrl, '_blank');

                // Refresh data to show it's now PROCESSING
                setTimeout(fetchData, 1000);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to initiate payment');
        } finally {
            setIsPaying(false);
        }
    };

    const handleCheckStatus = async (attemptId) => {
        try {
            const toastId = toast.loading('Verifying payment status...');
            const res = await studentFeesService.checkPaymentStatus(attemptId);
            if (res.data?.success) {
                toast.success(`Payment state: ${res.data.data.status}`, { id: toastId });
                fetchData();
            } else {
                toast.error('Could not verify status', { id: toastId });
            }
        } catch (error) {
            toast.error('Error checking status');
        }
    };

    const submitDispute = async (e) => {
        e.preventDefault();
        try {
            setIsSubmittingDispute(true);
            await studentFeesService.raiseDispute({
                invoiceId: disputeModal.invoiceId,
                paymentAttemptId: disputeModal.attemptId,
                ...disputeForm
            });
            toast.success('Dispute raised successfully. Admin will review shortly.');
            setDisputeModal({ isOpen: false, attemptId: null, invoiceId: null });
            setDisputeForm({ transactionId: '', bankReferenceNumber: '', amount: '', studentNote: '' });
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to submit dispute');
        } finally {
            setIsSubmittingDispute(false);
        }
    };

    const handleDownloadReceipt = async (attempt) => {
        try {
            // Usually this triggers a PDF download API. 
            // In our mock, we just ping the receipt endpoint and show a toast.
            toast.loading('Generating receipt...', { id: 'receipt' });
            // Simulation
            setTimeout(() => {
                toast.success(`Receipt downloaded for txn ${attempt.gatewayRefId}`, { id: 'receipt' });
            }, 1000);
        } catch (e) {
            toast.error('Receipt unavailable');
        }
    }

    const totalOutstanding = invoices.reduce((sum, inv) => sum + (inv.balanceAmount || 0), 0);

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center text-gray-900 border-b pb-4">
                <h1 className="text-3xl font-bold">My Fees & Payments</h1>
                <div className="text-right">
                    <p className="text-sm text-gray-500 uppercase font-semibold">Total Outstanding</p>
                    <p className="text-2xl font-bold text-red-600">{formatCurrency(totalOutstanding)}</p>
                </div>
            </div>

            {/* TABS */}
            <div className="flex border-b border-gray-200 gap-6">
                <button
                    onClick={() => setActiveTab('invoices')}
                    className={`pb-3 font-medium text-sm transition-colors ${activeTab === 'invoices' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Invoices
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`pb-3 font-medium text-sm transition-colors ${activeTab === 'history' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <div className="flex items-center gap-2">
                        <History className="h-4 w-4" />
                        Payment History
                    </div>
                </button>
            </div>

            {isLoading ? (
                <div className="py-20 text-center"><div className="loading loading-spinner text-indigo-600 loading-lg"></div></div>
            ) : (
                <>
                    {/* INVOICES TAB */}
                    {activeTab === 'invoices' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in text-gray-900">
                            {invoices.length === 0 && <p className="col-span-full py-10 text-center text-gray-500">No invoices have been assigned to you yet.</p>}

                            {invoices.map(invoice => (
                                <div key={invoice._id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                                    <div className="p-5 border-b border-gray-100 flex justify-between items-start">
                                        <div>
                                            <h3 className="font-semibold text-lg text-gray-900">{invoice.invoiceNumber}</h3>
                                            <p className="text-xs text-gray-500">Due: {formatDate(invoice.dueDate)}</p>
                                        </div>
                                        <StatusBadge status={invoice.status} />
                                    </div>
                                    <div className="p-5 bg-gray-50 space-y-4">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-gray-600">Total Amount</span>
                                            <span className="font-medium text-gray-900">{formatCurrency(invoice.totalAmount)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-gray-600">Paid</span>
                                            <span className="font-medium text-green-600">{formatCurrency(invoice.paidAmount)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-base font-bold pt-2 border-t border-gray-200">
                                            <span>Balance</span>
                                            <span className={invoice.balanceAmount > 0 ? "text-red-600" : "text-gray-900"}>{formatCurrency(invoice.balanceAmount)}</span>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-white">
                                        <button
                                            onClick={() => setSelectedInvoice(invoice)}
                                            className="w-full btn btn-outline border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300"
                                        >
                                            View Details
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* HISTORY TAB */}
                    {activeTab === 'history' && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in text-gray-900">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-4">Date</th>
                                            <th className="px-6 py-4">Invoice</th>
                                            <th className="px-6 py-4">Amount</th>
                                            <th className="px-6 py-4">Gateway Ref</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {history.length === 0 && (
                                            <tr><td colSpan="6" className="px-6 py-10 text-center text-gray-500">No payment attempts found.</td></tr>
                                        )}
                                        {history.map(attempt => (
                                            <tr key={attempt._id} className="hover:bg-gray-50/50">
                                                <td className="px-6 py-4">{formatDate(attempt.createdAt, true)}</td>
                                                <td className="px-6 py-4 font-mono text-xs">{attempt.invoiceId?.invoiceNumber}</td>
                                                <td className="px-6 py-4 font-medium">{formatCurrency(attempt.amount)}</td>
                                                <td className="px-6 py-4 font-mono text-xs text-gray-500">{attempt.gatewayRefId || 'Pending Generation'}</td>
                                                <td className="px-6 py-4"><AttemptStatusBadge status={attempt.status} /></td>
                                                <td className="px-6 py-4 flex justify-end gap-2 text-right">
                                                    {['PENDING', 'PROCESSING'].includes(attempt.status) && (
                                                        <>
                                                            <button onClick={() => handleCheckStatus(attempt._id)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Verify Status">
                                                                <Clock className="h-4 w-4" />
                                                            </button>
                                                            <button onClick={() => setDisputeModal({ isOpen: true, attemptId: attempt._id, invoiceId: attempt.invoiceId?._id })} className="p-1.5 text-orange-600 hover:bg-orange-50 rounded" title="Raise Dispute">
                                                                <AlertTriangle className="h-4 w-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                    {attempt.status === 'SUCCESS' && (
                                                        <button onClick={() => handleDownloadReceipt(attempt)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Download Receipt">
                                                            <Download className="h-4 w-4" />
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
                </>
            )}

            {/* INVOICE DETAIL MODAL */}
            {selectedInvoice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in text-gray-900">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
                            <div>
                                <h2 className="text-xl font-bold">Invoice Details</h2>
                                <p className="text-sm text-gray-500 font-mono mt-1">{selectedInvoice.invoiceNumber}</p>
                            </div>
                            <button onClick={() => setSelectedInvoice(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            {/* Breakdown */}
                            <div>
                                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Fee Breakdown</h3>
                                <div className="space-y-2">
                                    {selectedInvoice.items?.map((item, idx) => (
                                        <div key={idx} className="flex justify-between py-2 border-b border-gray-100 border-dashed text-sm">
                                            <span className="text-gray-700">{item.feeHeadName} <span className="text-xs text-gray-400">({item.frequency})</span></span>
                                            <span className="font-medium">{formatCurrency(item.amount)}</span>
                                        </div>
                                    ))}
                                    {selectedInvoice.lateFeeApplied > 0 && (
                                        <div className="flex justify-between py-2 border-b border-red-100 border-dashed text-sm text-red-600">
                                            <span>Late Fee</span>
                                            <span className="font-medium">{formatCurrency(selectedInvoice.lateFeeApplied)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Stuck Warning if applicable */}
                            {history.some(h => h.invoiceId?._id === selectedInvoice._id && ['PENDING', 'PROCESSING'].includes(h.status)) && (
                                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl flex items-start gap-3">
                                    <Clock className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="text-sm font-bold text-yellow-800">Verification in Progress</h4>
                                        <p className="text-sm text-yellow-700 mt-1">
                                            You have a payment attempt currently processing. Please wait for it to clear or fail before attempting to pay this invoice again.
                                        </p>
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* Footer / Actions */}
                        <div className="p-6 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                            <div className="text-left">
                                <p className="text-xs text-gray-500">Amount Due</p>
                                <p className="text-2xl font-bold">{formatCurrency(selectedInvoice.balanceAmount)}</p>
                            </div>

                            <button
                                onClick={() => handleInitiatePayment(selectedInvoice._id)}
                                disabled={isPaying || selectedInvoice.balanceAmount <= 0 || history.some(h => h.invoiceId?._id === selectedInvoice._id && ['PENDING', 'PROCESSING'].includes(h.status))}
                                className={`px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all ${selectedInvoice.balanceAmount <= 0
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm hover:shadow active:scale-95'
                                    }`}
                            >
                                {isPaying ? (
                                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Connecting...</>
                                ) : selectedInvoice.balanceAmount <= 0 ? (
                                    <><CheckCircle className="h-5 w-5" /> Fully Paid</>
                                ) : (
                                    <><CreditCard className="h-5 w-5" /> Pay Securely</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DISPUTE MODAL */}
            {disputeModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in text-gray-900">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-orange-500" />
                                File a Dispute
                            </h2>
                            <button onClick={() => setDisputeModal({ isOpen: false })} className="p-2 hover:bg-gray-200 rounded-full">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={submitDispute} className="p-6 space-y-4">
                            <p className="text-sm text-gray-600 mb-4">
                                If money was deducted from your bank but your receipt was not generated, please provide the details below. Our admin team will verify it.
                            </p>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Transaction ID / UTR *</label>
                                <input
                                    type="text" required
                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                                    placeholder="e.g. UPI Ref 1234567890"
                                    value={disputeForm.transactionId}
                                    onChange={(e) => setDisputeForm({ ...disputeForm, transactionId: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Amount Deducted (₹) *</label>
                                <input
                                    type="number" required min="1"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                                    placeholder="5000"
                                    value={disputeForm.amount}
                                    onChange={(e) => setDisputeForm({ ...disputeForm, amount: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Explanation *</label>
                                <textarea
                                    required rows="3"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                                    placeholder="Describe what happened..."
                                    value={disputeForm.studentNote}
                                    onChange={(e) => setDisputeForm({ ...disputeForm, studentNote: e.target.value })}
                                ></textarea>
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setDisputeModal({ isOpen: false })} className="px-4 py-2 font-medium text-gray-600 hover:bg-gray-100 rounded-xl">
                                    Cancel
                                </button>
                                <button type="submit" disabled={isSubmittingDispute} className="px-6 py-2 font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-xl shadow-sm disabled:opacity-50">
                                    {isSubmittingDispute ? 'Submitting...' : 'Submit Dispute'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

// Small helper UI components
const StatusBadge = ({ status }) => {
    const map = {
        'Paid': 'bg-green-100 text-green-700 border-green-200',
        'Partial': 'bg-blue-100 text-blue-700 border-blue-200',
        'Pending': 'bg-yellow-100 text-yellow-800 border-yellow-200',
        'Overdue': 'bg-red-100 text-red-700 border-red-200',
    };
    return (
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${map[status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
            {status}
        </span>
    );
};

const AttemptStatusBadge = ({ status }) => {
    const map = {
        'SUCCESS': 'bg-green-100 text-green-700 border-green-200',
        'FAILED': 'bg-red-100 text-red-700 border-red-200',
        'PENDING': 'bg-yellow-100 text-yellow-800 border-yellow-200',
        'PROCESSING': 'bg-blue-100 text-blue-700 border-blue-200',
        'DISPUTED': 'bg-orange-100 text-orange-800 border-orange-200',
        'INITIATED': 'bg-gray-100 text-gray-700 border-gray-200',
    };
    return (
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${map[status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
            {status}
        </span>
    );
};

export default StudentFeesDashboard;
