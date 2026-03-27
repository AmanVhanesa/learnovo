import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, AlertTriangle, ArrowLeft } from 'lucide-react';

/**
 * Payment Status Page
 *
 * The student's browser is redirected here by the backend after ICICI
 * EazyPay processes the payment. URL params carry the result:
 *   ?status=success&ref=...&bankRef=...&amount=...
 *   ?status=failed&ref=...&code=...&message=...
 *   ?status=error&message=...
 */
const PaymentStatus = () => {
    const [searchParams] = useSearchParams();
    const status = searchParams.get('status');
    const ref = searchParams.get('ref') || '';
    const bankRef = searchParams.get('bankRef') || '';
    const amount = searchParams.get('amount') || '';
    const code = searchParams.get('code') || '';
    const message = searchParams.get('message') || '';

    const [countdown, setCountdown] = useState(10);

    // Auto-redirect to fees dashboard after 10 seconds
    useEffect(() => {
        if (countdown <= 0) return;
        const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [countdown]);

    const formatCurrency = (val) => {
        const num = parseFloat(val);
        if (isNaN(num)) return val;
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(num);
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
                {/* Success */}
                {status === 'success' && (
                    <>
                        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle className="w-10 h-10 text-green-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
                        <p className="text-gray-600 mb-6">Your fee payment has been received and recorded.</p>

                        <div className="bg-green-50 rounded-lg p-4 mb-6 text-left space-y-2">
                            {amount && (
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Amount Paid</span>
                                    <span className="text-sm font-semibold text-gray-900">{formatCurrency(amount)}</span>
                                </div>
                            )}
                            {bankRef && (
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Bank Reference</span>
                                    <span className="text-sm font-mono text-gray-900">{bankRef}</span>
                                </div>
                            )}
                            {ref && (
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Reference No</span>
                                    <span className="text-sm font-mono text-gray-900 break-all">{ref}</span>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* Failed */}
                {status === 'failed' && (
                    <>
                        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                            <XCircle className="w-10 h-10 text-red-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Failed</h1>
                        <p className="text-gray-600 mb-6">
                            {message || 'Your payment could not be processed. Please try again.'}
                        </p>

                        {(code || ref) && (
                            <div className="bg-red-50 rounded-lg p-4 mb-6 text-left space-y-2">
                                {code && (
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Error Code</span>
                                        <span className="text-sm font-mono text-gray-900">{code}</span>
                                    </div>
                                )}
                                {ref && (
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Reference</span>
                                        <span className="text-sm font-mono text-gray-900 break-all">{ref}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* Error */}
                {status === 'error' && (
                    <>
                        <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                            <AlertTriangle className="w-10 h-10 text-yellow-600" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Something Went Wrong</h1>
                        <p className="text-gray-600 mb-6">
                            {message || 'There was an issue verifying your payment. If money was debited, it will be refunded or reconciled within 24-48 hours.'}
                        </p>
                    </>
                )}

                {/* No status param */}
                {!status && (
                    <>
                        <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <AlertTriangle className="w-10 h-10 text-gray-400" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">No Payment Info</h1>
                        <p className="text-gray-600 mb-6">This page shows payment results. It looks like you accessed it directly.</p>
                    </>
                )}

                {/* Actions */}
                <div className="space-y-3">
                    <Link
                        to="/app/student/fees"
                        className="block w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4 inline mr-2" />
                        Go to Fees Dashboard
                    </Link>
                    <p className="text-xs text-gray-400">
                        Redirecting automatically in {countdown > 0 ? countdown : 0}s...
                    </p>
                    {countdown <= 0 && (
                        <meta httpEquiv="refresh" content={`0; url=/app/student/fees`} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default PaymentStatus;
