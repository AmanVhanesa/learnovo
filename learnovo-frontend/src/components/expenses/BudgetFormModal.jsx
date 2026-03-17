import React, { useState, useEffect } from 'react'
import { IndianRupee } from 'lucide-react'
import ModalWrapper from '../ModalWrapper'
import toast from 'react-hot-toast'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const BudgetFormModal = ({ budget, category, month, year, onClose, onSave }) => {
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (budget) setAmount(budget.budgetAmount || '')
  }, [budget])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!amount || parseFloat(amount) < 0) {
      toast.error('Please enter a valid budget amount')
      return
    }
    setSaving(true)
    try {
      await onSave({
        category: category?._id || budget?.category?._id,
        month,
        year,
        budgetAmount: parseFloat(amount)
      })
    } finally {
      setSaving(false)
    }
  }

  const catName = category?.name || budget?.category?.name || 'Category'
  const catColor = category?.color || budget?.category?.color || '#6B7280'

  return (
    <ModalWrapper title="Set Monthly Budget" onClose={onClose} maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="p-6">
        <div className="space-y-5">
          {/* Category & Month info */}
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-gray-50 dark:bg-[#2C2C2E] ring-1 ring-gray-100 dark:ring-[#38383A]/40">
            <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: catColor }} />
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{catName}</p>
              <p className="text-xs text-gray-500 dark:text-[#8E8E93]">{MONTH_NAMES[month - 1]} {year}</p>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="label mb-1.5">Monthly Budget Amount <span className="text-red-500">*</span></label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                <IndianRupee className="h-4 w-4 text-gray-400 dark:text-[#636366]" />
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input pl-9"
                placeholder="0.00"
                min="0"
                step="100"
                required
                autoFocus
              />
            </div>
            <p className="text-xs text-gray-400 dark:text-[#636366] mt-1.5">
              Set the maximum spending limit for this category this month
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-gray-100 dark:border-[#2C2C2E]">
          <button type="button" onClick={onClose} className="btn btn-outline">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'Saving...' : 'Save Budget'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  )
}

export default BudgetFormModal
