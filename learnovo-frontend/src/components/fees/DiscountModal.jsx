import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { discountsService } from '../../services/feesService'
import { formatCurrency } from '../../utils/formatCurrency'
import ModalWrapper from '../ModalWrapper'

const DISCOUNT_TYPES = [
  'Scholarship',
  'Sibling Discount',
  'Staff Ward',
  'Merit-based',
  'Financial Hardship',
  'Other'
]

const DiscountModal = ({ isOpen, onClose, invoice, onSuccess }) => {
  const [mode, setMode] = useState('fixed')
  const [form, setForm] = useState({
    type: '',
    amount: '',
    percentage: '',
    reason: ''
  })
  const [isSaving, setIsSaving] = useState(false)

  // Reset form state whenever the modal opens or the invoice changes
  useEffect(() => {
    if (isOpen) {
      setMode('fixed')
      setForm({ type: '', amount: '', percentage: '', reason: '' })
    }
  }, [isOpen, invoice?._id])

  if (!isOpen || !invoice) return null

  const calculatedAmount = mode === 'percentage'
    ? Math.round((parseFloat(form.percentage || 0) / 100) * invoice.totalAmount)
    : parseFloat(form.amount || 0)

  const discountedTotal = Math.max(0, invoice.totalAmount - calculatedAmount)

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.type) {
      toast.error('Please select a discount type')
      return
    }
    if (!form.reason.trim()) {
      toast.error('Please provide a reason')
      return
    }
    if (calculatedAmount <= 0) {
      toast.error('Discount amount must be greater than zero')
      return
    }
    if (calculatedAmount > invoice.totalAmount) {
      toast.error('Discount cannot exceed the total amount')
      return
    }

    try {
      setIsSaving(true)

      const payload = {
        type: form.type,
        reason: form.reason.trim()
      }

      if (mode === 'fixed') {
        payload.amount = parseFloat(form.amount)
      } else {
        payload.percentage = parseFloat(form.percentage)
        payload.amount = calculatedAmount
      }

      await discountsService.applyDiscount(invoice._id, payload)
      toast.success('Discount applied successfully')
      onSuccess()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to apply discount')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <ModalWrapper title="Apply Discount / Waiver" onClose={onClose}>
      <div className="p-4 sm:p-6">
        {/* Invoice summary */}
        <div className="p-4 bg-gray-50 dark:bg-[#2C2C2E] rounded-xl border border-gray-100 dark:border-[#38383A] mb-6">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-500 dark:text-[#8E8E93]">Invoice</span>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">{invoice.invoiceNumber}</span>
          </div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-500 dark:text-[#8E8E93]">Student</span>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {invoice.studentId?.fullName || invoice.studentId?.name || 'N/A'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-500 dark:text-[#8E8E93]">Total Amount</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(invoice.totalAmount)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Discount Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-2">Discount Type *</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-[#1C1C1E] dark:text-white"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              required
            >
              <option value="">Select type...</option>
              {DISCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Mode toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-2">Mode</label>
            <div className="flex rounded-lg border border-gray-300 dark:border-[#38383A] overflow-hidden">
              <button
                type="button"
                className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'fixed' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-[#1C1C1E] text-gray-600 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#000000]'}`}
                onClick={() => setMode('fixed')}
              >
                Fixed Amount
              </button>
              <button
                type="button"
                className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'percentage' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-[#1C1C1E] text-gray-600 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#000000]'}`}
                onClick={() => setMode('percentage')}
              >
                Percentage
              </button>
            </div>
          </div>

          {/* Amount or Percentage input */}
          {mode === 'fixed' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-2">Amount *</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-[#1C1C1E] dark:text-white"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                max={invoice.totalAmount}
                min="0"
                step="any"
                placeholder="Enter discount amount"
                required
              />
              <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-1">
                Maximum: {formatCurrency(invoice.totalAmount)}
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-2">Percentage *</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-[#1C1C1E] dark:text-white"
                value={form.percentage}
                onChange={(e) => setForm({ ...form, percentage: e.target.value })}
                max="100"
                min="1"
                step="1"
                placeholder="Enter percentage (1-100)"
                required
              />
              {form.percentage && (
                <p className="text-sm text-primary-600 dark:text-primary-400 mt-1 font-medium">
                  Discount amount: {formatCurrency(calculatedAmount)}
                </p>
              )}
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-2">Reason *</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-[#1C1C1E] dark:text-white"
              rows="3"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Provide reason for this discount/waiver"
              required
            />
          </div>

          {/* Preview */}
          {calculatedAmount > 0 && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800/40">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-green-700 dark:text-green-300">Original Total</span>
                <span className="text-sm text-green-800 dark:text-green-200">{formatCurrency(invoice.totalAmount)}</span>
              </div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-green-700 dark:text-green-300">Discount</span>
                <span className="text-sm text-red-600 dark:text-red-400">- {formatCurrency(calculatedAmount)}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-green-200 dark:border-green-800/40">
                <span className="text-sm font-semibold text-green-800 dark:text-green-200">Discounted Total</span>
                <span className="text-lg font-bold text-green-800 dark:text-green-100">{formatCurrency(discountedTotal)}</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-4 border-t border-gray-200 dark:border-[#38383A]">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 text-gray-700 dark:text-[#8E8E93] hover:bg-gray-100 dark:hover:bg-[#000000] rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              disabled={isSaving}
            >
              {isSaving ? 'Applying...' : 'Apply Discount'}
            </button>
          </div>
        </form>
      </div>
    </ModalWrapper>
  )
}

export default DiscountModal
