import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { paymentsService } from '../../services/feesService'

const METHODS = ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card', 'Online']

// Format a Date into the local `YYYY-MM-DDTHH:mm` value an <input type="datetime-local"> expects
const toLocalDateTimeInput = (d) => {
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

const PaymentEditModal = ({ payment, mode, onClose, onSuccess }) => {
  const isReverse = mode === 'reverse'
  const [paymentMethod, setPaymentMethod] = useState(payment.paymentMethod || 'Cash')
  const [paymentDate, setPaymentDate] = useState(
    payment.paymentDate ? toLocalDateTimeInput(payment.paymentDate) : ''
  )
  const [depositorName, setDepositorName] = useState(payment.depositorName || '')
  const [referenceNumber, setReferenceNumber] = useState(payment.transactionDetails?.referenceNumber || '')
  const [onlineMode, setOnlineMode] = useState(payment.transactionDetails?.onlineMode || '')
  const [remarks, setRemarks] = useState(payment.remarks || '')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (isReverse) {
        if (!reason.trim()) { toast.error('Reason is required'); setSaving(false); return }
        await paymentsService.reverse(payment._id, reason.trim())
        toast.success('Payment reversed')
      } else {
        await paymentsService.update(payment._id, {
          paymentMethod,
          paymentDate: paymentDate ? new Date(paymentDate).toISOString() : undefined,
          depositorName,
          remarks,
          transactionDetails: {
            ...(payment.transactionDetails || {}),
            referenceNumber,
            ...(paymentMethod === 'Online' ? { onlineMode: onlineMode || undefined } : {})
          },
        })
        toast.success('Payment updated')
      }
      onSuccess()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white dark:bg-[#1C1C1E] rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-[#38383A] p-5">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isReverse ? 'Reverse Payment' : 'Edit Payment'}
            </h3>
            <p className="text-sm text-gray-500 dark:text-[#8E8E93]">
              Receipt #{payment.receiptNumber} — ₹{Number(payment.amount).toLocaleString()}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-[#2C2C2E]">
            <X className="h-5 w-5 text-gray-500 dark:text-[#8E8E93]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {isReverse ? (
            <>
              <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg text-sm text-red-700 dark:text-red-400">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div>
                  Reversing creates a negative payment entry, restores the invoice balance, and removes the
                  corresponding Income record. This action cannot be undone.
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-white mb-1">Reason</label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg text-sm dark:bg-[#1C1C1E] dark:text-white"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="e.g., Payment applied to wrong student; collecting again correctly"
                  required
                />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-white mb-1">Payment Method</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg text-sm dark:bg-[#1C1C1E] dark:text-white"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-white mb-1">Payment Date &amp; Time</label>
                  <input
                    type="datetime-local"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg text-sm dark:bg-[#1C1C1E] dark:text-white"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-white mb-1">Depositor Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg text-sm dark:bg-[#1C1C1E] dark:text-white"
                  value={depositorName}
                  onChange={(e) => setDepositorName(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              {paymentMethod === 'Online' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-white mb-1">Online Mode</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg text-sm dark:bg-[#1C1C1E] dark:text-white"
                    value={onlineMode}
                    onChange={(e) => setOnlineMode(e.target.value)}
                  >
                    <option value="">Select online mode…</option>
                    <option value="UPI">UPI</option>
                    <option value="NEFT">NEFT</option>
                    <option value="IMPS">IMPS</option>
                    <option value="RTGS">RTGS</option>
                    <option value="Net Banking">Net Banking</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-white mb-1">Reference / Txn No.</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg text-sm dark:bg-[#1C1C1E] dark:text-white"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-white mb-1">Remarks</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg text-sm dark:bg-[#1C1C1E] dark:text-white"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-[#8E8E93]">
                To change the amount or move this payment to another student, reverse it and collect again.
              </p>
            </>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-[#38383A]">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-700 dark:text-[#8E8E93] hover:bg-gray-100 dark:hover:bg-[#2C2C2E] rounded-lg">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 ${isReverse ? 'bg-red-600 hover:bg-red-700' : 'bg-primary-600 hover:bg-primary-700'}`}
            >
              {saving ? 'Saving...' : isReverse ? 'Reverse Payment' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

export default PaymentEditModal
