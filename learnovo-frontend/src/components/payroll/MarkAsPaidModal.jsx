import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';

const PAYMENT_METHODS = [
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'cash', label: 'Cash' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'online', label: 'Online' }
];

const todayIso = () => new Date().toISOString().slice(0, 10);

const MarkAsPaidModal = ({ isOpen, onClose, onConfirm, recordCount = 1, loading = false }) => {
    const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
    const [paymentDate, setPaymentDate] = useState(todayIso());
    const [paymentReference, setPaymentReference] = useState('');

    useEffect(() => {
        if (isOpen) {
            setPaymentMethod('bank_transfer');
            setPaymentDate(todayIso());
            setPaymentReference('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        onConfirm({
            paymentMethod,
            paymentDate: new Date(paymentDate).toISOString(),
            paymentReference: paymentReference.trim() || undefined
        });
    };

    const isBulk = recordCount > 1;

    return createPortal(
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]">
            <div className="bg-white dark:bg-[#1C1C1E] rounded-lg shadow-xl max-w-md w-full mx-4">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-[#38383A]">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                        Mark {isBulk ? `${recordCount} Payrolls` : 'Payroll'} as Paid
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-[#8E8E93] mt-1">
                        Record the actual payment details so the expense entry reflects how the salary was disbursed.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                            Payment Method <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value)}
                            required
                            className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-[#1C1C1E] dark:text-white"
                        >
                            {PAYMENT_METHODS.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                            Payment Date <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="date"
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                            required
                            max={todayIso()}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-[#1C1C1E] dark:text-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">
                            Reference / Transaction ID
                        </label>
                        <input
                            type="text"
                            value={paymentReference}
                            onChange={(e) => setPaymentReference(e.target.value)}
                            placeholder="e.g. NEFT UTR, cheque no., UPI ref"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-[#1C1C1E] dark:text-white dark:placeholder-[#636366]"
                        />
                        <p className="text-xs text-gray-500 dark:text-[#636366] mt-1">
                            Optional. {isBulk ? 'Applied to every selected record.' : ''}
                        </p>
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="px-4 py-2 border border-gray-300 dark:border-[#38383A] rounded-md text-gray-700 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Saving...' : `Mark as Paid${isBulk ? ` (${recordCount})` : ''}`}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

MarkAsPaidModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onConfirm: PropTypes.func.isRequired,
    recordCount: PropTypes.number,
    loading: PropTypes.bool
};

export default MarkAsPaidModal;
