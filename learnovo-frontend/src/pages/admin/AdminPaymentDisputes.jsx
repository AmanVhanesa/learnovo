import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, XCircle, Clock, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminDisputesService } from '../../services/adminDisputesService';

const AdminPaymentDisputes = () => {
    const [disputes, setDisputes] = useState([]);
    const [stuckPayments, setStuckPayments] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [resolveModal, setResolveModal] = useState({ isOpen: false, dispute: null });
    const [resolveForm, setResolveForm] = useState({ action: 'APPROVE', note: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 60000); // Poll every minute
        return () => clearInterval(interval);
    }, []);

    const fetchData = async () => {
        try {
            const res = await adminDisputesService.getDisputes();
            if (res.data?.success) {
                setDisputes(res.data.data.disputes || []);
                setStuckPayments(res.data.data.stuckPayments || []);
            }
        } catch (error) {
            toast.error('Failed to load disputes data');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResolve = async (e) => {
        e.preventDefault();
        try {
            setIsSubmitting(true);
            await adminDisputesService.resolveDispute(
                resolveModal.dispute._id,
                resolveForm.action,
                resolveForm.note
            );
            toast.success(`Dispute ${resolveForm.action === 'APPROVE' ? 'approved & marked Paid' : 'rejected'}`);
            setResolveModal({ isOpen: false, dispute: null });
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to resolve dispute');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in text-gray-900">
            <div>
                <h1 className="text-3xl font-bold">Payment Disputes & Alerts</h1>
                <p className="text-gray-500 mt-2">Manage student payment claims and monitor stuck transactions.</p>
            </div>

            {isLoading ? (
                <div className="py-20 text-center"><div className="loading loading-spinner text-indigo-600 loading-lg"></div></div>
            ) : (
                <>
                    {/* Stuck Payments Warning Section */}
                    {stuckPayments.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden shadow-sm">
                            <div className="bg-red-100 p-4 border-b border-red-200 flex gap-3 items-center">
                                <AlertCircle className="h-5 w-5 text-red-700" />
                                <h2 className="font-bold text-red-900">System Alert: Payments Stuck Processing (&gt;1hr)</h2>
                                <span className="ml-auto bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{stuckPayments.length} limits</span>
                            </div>
                            <div className="p-0">
                                <table className="w-full text-left text-sm bg-white">
                                    <thead className="text-red-800 bg-red-50/50">
                                        <tr>
                                            <th className="px-6 py-3 border-b border-red-100">Student</th>
                                            <th className="px-6 py-3 border-b border-red-100">Invoice ID</th>
                                            <th className="px-6 py-3 border-b border-red-100">Attempt ID</th>
                                            <th className="px-6 py-3 border-b border-red-100">Amount</th>
                                            <th className="px-6 py-3 border-b border-red-100">Started</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-red-100">
                                        {stuckPayments.map(p => (
                                            <tr key={p._id} className="hover:bg-red-50/20">
                                                <td className="px-6 py-3 font-medium">{p.studentId?.fullName}</td>
                                                <td className="px-6 py-3 font-mono text-xs">{p.invoiceId?.invoiceNumber}</td>
                                                <td className="px-6 py-3 font-mono text-xs text-gray-500">{p._id}</td>
                                                <td className="px-6 py-3 font-medium text-red-700">₹{p.amount}</td>
                                                <td className="px-6 py-3 text-red-600 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Active Disputes Section */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h2 className="text-lg font-bold">Active Student Claims</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4">Student</th>
                                        <th className="px-6 py-4">UTR / Transaction ID</th>
                                        <th className="px-6 py-4">Amount Claimed</th>
                                        <th className="px-6 py-4">Invoice Status</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {disputes.length === 0 && (
                                        <tr><td colSpan="6" className="px-6 py-10 text-center text-gray-500">No active disputes to review.</td></tr>
                                    )}
                                    {disputes.map(dispute => (
                                        <tr key={dispute._id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">{new Date(dispute.createdAt).toLocaleDateString()}</td>
                                            <td className="px-6 py-4">
                                                <p className="font-medium text-gray-900">{dispute.studentId?.fullName}</p>
                                                <p className="text-xs text-gray-500">{dispute.studentId?.email}</p>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-xs">{dispute.transactionId || dispute.bankReferenceNumber}</td>
                                            <td className="px-6 py-4 font-medium text-orange-600">₹{dispute.amount}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded text-xs font-semibold ${dispute.invoiceId?.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                                                    dispute.invoiceId?.status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-gray-100'
                                                    }`}>
                                                    {dispute.invoiceId?.status || 'Unknown'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => setResolveModal({ isOpen: true, dispute })}
                                                    className="px-4 py-1.5 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                                                >
                                                    Review & Resolve
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* RESOLVE MODAL */}
            {resolveModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in text-gray-900">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
                        <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                            <h2 className="text-xl font-bold">Resolve Dispute Claim</h2>
                            <button onClick={() => setResolveModal({ isOpen: false, dispute: null })} className="p-2 hover:bg-gray-200 rounded-full">
                                <XCircle className="h-5 w-5 text-gray-500" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5 bg-gray-50/30">
                            <div>
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Student's Explanation</h3>
                                <p className="text-sm p-4 bg-white border border-gray-200 rounded-xl italic">"{resolveModal.dispute.studentNote}"</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div className="p-3 bg-white border border-gray-100 rounded-lg">
                                    <span className="text-gray-500 block mb-1">Claimed Amount</span>
                                    <span className="font-bold text-lg">₹{resolveModal.dispute.amount}</span>
                                </div>
                                <div className="p-3 bg-white border border-gray-100 rounded-lg">
                                    <span className="text-gray-500 block mb-1">Invoice Total</span>
                                    <span className="font-bold text-lg">₹{resolveModal.dispute.invoiceId?.totalAmount}</span>
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleResolve} className="p-6 border-t border-gray-100 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Resolution Action *</label>
                                <div className="flex gap-4">
                                    <label className={`flex-1 flex items-center justify-center gap-2 p-3 border rounded-xl cursor-pointer transition-colors ${resolveForm.action === 'APPROVE' ? 'bg-green-50 border-green-500 text-green-700' : 'hover:bg-gray-50 border-gray-200 text-gray-600'}`}>
                                        <input type="radio" name="action" value="APPROVE" className="hidden" checked={resolveForm.action === 'APPROVE'} onChange={(e) => setResolveForm({ ...resolveForm, action: 'APPROVE' })} />
                                        <CheckCircle className="h-5 w-5" />
                                        <span className="font-bold">Approve Claim</span>
                                    </label>
                                    <label className={`flex-1 flex items-center justify-center gap-2 p-3 border rounded-xl cursor-pointer transition-colors ${resolveForm.action === 'REJECT' ? 'bg-red-50 border-red-500 text-red-700' : 'hover:bg-gray-50 border-gray-200 text-gray-600'}`}>
                                        <input type="radio" name="action" value="REJECT" className="hidden" checked={resolveForm.action === 'REJECT'} onChange={(e) => setResolveForm({ ...resolveForm, action: 'REJECT' })} />
                                        <XCircle className="h-5 w-5" />
                                        <span className="font-bold">Reject Claim</span>
                                    </label>
                                </div>
                                {resolveForm.action === 'APPROVE' && <p className="text-xs text-green-600 mt-2">Approving this will instantly mark the invoice as Paid matching the attempt amount.</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Response Note *</label>
                                <textarea
                                    required rows="3"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                                    placeholder="e.g. Verified with bank statement matching UTR."
                                    value={resolveForm.note}
                                    onChange={(e) => setResolveForm({ ...resolveForm, note: e.target.value })}
                                ></textarea>
                            </div>

                            <div className="pt-2 flex justify-end gap-3">
                                <button type="button" onClick={() => setResolveModal({ isOpen: false, dispute: null })} className="px-4 py-2 font-medium text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
                                <button type="submit" disabled={isSubmitting} className="px-6 py-2 font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm disabled:opacity-50">
                                    {isSubmitting ? 'Saving...' : 'Confirm Resolution'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPaymentDisputes;
