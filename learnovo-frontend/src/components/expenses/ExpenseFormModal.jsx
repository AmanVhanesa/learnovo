import React, { useState, useEffect } from 'react'
import { X, IndianRupee } from 'lucide-react'
import ModalWrapper from '../ModalWrapper'
import toast from 'react-hot-toast'

const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card']

const ExpenseFormModal = ({ expense, categories, onClose, onSave }) => {
  const isEdit = !!expense
  const [form, setForm] = useState({
    category: '',
    title: '',
    amount: '',
    expenseDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'Cash',
    paymentReference: '',
    description: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (expense) {
      setForm({
        category: expense.category?._id || expense.category || '',
        title: expense.title || '',
        amount: expense.amount || '',
        expenseDate: expense.expenseDate ? new Date(expense.expenseDate).toISOString().split('T')[0] : '',
        paymentMethod: expense.paymentMethod || 'Cash',
        paymentReference: expense.paymentReference || '',
        description: expense.description || ''
      })
    }
  }, [expense])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.category || !form.title || !form.amount || !form.expenseDate) {
      toast.error('Please fill all required fields')
      return
    }
    if (parseFloat(form.amount) <= 0) {
      toast.error('Amount must be greater than 0')
      return
    }

    setSaving(true)
    try {
      await onSave({ ...form, amount: parseFloat(form.amount) })
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  return (
    <ModalWrapper title={isEdit ? 'Edit Expense' : 'Add New Expense'} onClose={onClose} maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="p-6">
        <div className="space-y-6">
          {/* Row 1: Category + Title */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label mb-1.5">Category <span className="text-red-500">*</span></label>
              <select
                value={form.category}
                onChange={(e) => handleChange('category', e.target.value)}
                className="input"
                required
              >
                <option value="">Select category</option>
                {categories.map(cat => (
                  <option key={cat._id} value={cat._id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label mb-1.5">Title <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => handleChange('title', e.target.value)}
                className="input"
                placeholder="e.g., Electricity bill"
                required
              />
            </div>
          </div>

          {/* Row 2: Amount + Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label mb-1.5">Amount <span className="text-red-500">*</span></label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                  <IndianRupee className="h-4 w-4 text-gray-400 dark:text-[#636366]" />
                </div>
                <input
                  type="number"
                  value={form.amount}
                  onChange={(e) => handleChange('amount', e.target.value)}
                  className="input pl-9"
                  placeholder="0.00"
                  min="0.01"
                  step="0.01"
                  required
                />
              </div>
            </div>
            <div>
              <label className="label mb-1.5">Expense Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={form.expenseDate}
                onChange={(e) => handleChange('expenseDate', e.target.value)}
                className="input"
                required
              />
            </div>
          </div>

          {/* Row 3: Payment Method + Reference */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label mb-1.5">Payment Method <span className="text-red-500">*</span></label>
              <select
                value={form.paymentMethod}
                onChange={(e) => handleChange('paymentMethod', e.target.value)}
                className="input"
                required
              >
                {PAYMENT_METHODS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label mb-1.5">Payment Reference</label>
              <input
                type="text"
                value={form.paymentReference}
                onChange={(e) => handleChange('paymentReference', e.target.value)}
                className="input"
                placeholder="Cheque no / Txn ID"
              />
              <p className="text-xs text-gray-400 dark:text-[#636366] mt-1">Optional — cheque number, UPI ref, etc.</p>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="label mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="input h-auto"
              rows={3}
              placeholder="Additional details about this expense..."
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-gray-100 dark:border-[#2C2C2E]">
          <button type="button" onClick={onClose} className="btn btn-outline">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </>
            ) : isEdit ? 'Update Expense' : 'Add Expense'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  )
}

export default ExpenseFormModal
