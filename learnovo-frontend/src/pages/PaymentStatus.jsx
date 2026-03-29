import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, AlertTriangle, ArrowLeft } from 'lucide-react';

const PaymentStatus = () => {
    const [params] = useSearchParams();
    const status = params.get('status'); // success, failed, error
    const ref = params.get('ref');
    const bankRef = params.get('bankRef');
    const amount = params.get('amount');
    const message = params.get('message');
    const code = params.get('code');

    const isSuccess = status === 'success';
    const isFailed = status === 'failed';

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black p-4">
            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl border border-gray-200 dark:border-[#38383A] max-w-md w-full p-8 text-center space-y-6">
                {isSuccess ? (
                    <>
                        <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-500/10 rounded-full flex items-center justify-center">
                            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Payment Successful</h1>
                            <p className="text-gray-500 dark:text-[#8E8E93] mt-2">Your fee payment has been received and verified.</p>
                        </div>
                        {(amount || ref || bankRef) && (
                            <div className="bg-gray-50 dark:bg-[#2C2C2E] rounded-xl p-4 space-y-2 text-sm">
                                {amount && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 dark:text-[#8E8E93]">Amount</span>
                                        <span className="font-semibold text-gray-900 dark:text-white">₹{amount}</span>
                                    </div>
                                )}
                                {ref && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 dark:text-[#8E8E93]">Reference</span>
                                        <span className="font-mono text-xs text-gray-900 dark:text-white">{ref}</span>
                                    </div>
                                )}
                                {bankRef && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 dark:text-[#8E8E93]">Bank Ref</span>
                                        <span className="font-mono text-xs text-gray-900 dark:text-white">{bankRef}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                ) : isFailed ? (
                    <>
                        <div className="w-16 h-16 mx-auto bg-red-100 dark:bg-red-500/10 rounded-full flex items-center justify-center">
                            <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Payment Failed</h1>
                            <p className="text-gray-500 dark:text-[#8E8E93] mt-2">
                                {message || 'Your payment could not be processed. No amount has been deducted.'}
                            </p>
                            {code && <p className="text-xs text-gray-400 dark:text-[#636366] mt-1">Error code: {code}</p>}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="w-16 h-16 mx-auto bg-yellow-100 dark:bg-yellow-500/10 rounded-full flex items-center justify-center">
                            <AlertTriangle className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Payment Error</h1>
                            <p className="text-gray-500 dark:text-[#8E8E93] mt-2">
                                {message ? decodeURIComponent(message) : 'Something went wrong while processing your payment. If money was deducted, please raise a dispute from the fees page.'}
                            </p>
                        </div>
                    </>
                )}

                <Link
                    to="/app/student/fees"
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-500 transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to My Fees
                </Link>
            </div>
        </div>
    );
};

export default PaymentStatus;
