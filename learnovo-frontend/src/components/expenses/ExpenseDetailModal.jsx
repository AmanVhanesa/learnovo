import React, { useState } from 'react'
import { X, Check, Ban, Edit, Trash2, Calendar, CreditCard, User, FileText, Clock } from 'lucide-react'
import ModalWrapper from '../ModalWrapper'
import StatusBadge from '../StatusBadge'
import { formatCurrency } from '../../utils/formatCurrency'

const ExpenseDetailModal = ({ expense, onClose, onApprove, onReject, onEdit, onDelete }) => {
  const [showRejectInput, setShowRejectInput] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing] = useState(false)

  if (!expense) return null

  const handleApprove = async () => {
    setProcessing(true)
    try {
      await onApprove(expense._id)
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    setProcessing(true)
    try {
      await onReject(expense._id, rejectReason)
    } finally {
      setProcessing(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return
    await onDelete(expense._id)
  }

  const detailItems = [
    {
      icon: Calendar,
      label: 'Date',
      value: new Date(expense.expenseDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    },
    {
      icon: CreditCard,
      label: 'Payment Method',
      value: expense.paymentMethod
    },
    expense.paymentReference && {
      icon: FileText,
      label: 'Reference',
      value: expense.paymentReference
    },
    {
      icon: User,
      label: 'Added By',
      value: expense.addedBy?.name || '—'
    },
    {
      icon: Clock,
      label: 'Created',
      value: new Date(expense.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    },
    expense.approvedBy && {
      icon: User,
      label: expense.status === 'Approved' ? 'Approved By' : 'Rejected By',
      value: expense.approvedBy.name
    }
  ].filter(Boolean)

  return (
    <ModalWrapper title="Expense Details" onClose={onClose} maxWidth="max-w-2xl">
      <div className="p-6 space-y-6">
        {/* Header: Title + Status + Amount */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 mb-1">
              {expense.category && (
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-white dark:ring-dark-card"
                  style={{ backgroundColor: expense.category.color || '#6B7280' }}
                />
              )}
              <span className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide">
                {expense.category?.name || 'Uncategorized'}
              </span>
            </div>
            <h4 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{expense.title}</h4>
          </div>
          <StatusBadge status={expense.status} />
        </div>

        {/* Amount card */}
        <div className="bg-gradient-to-r from-primary-50 to-primary-50/30 dark:from-primary-500/10 dark:to-primary-500/5 rounded-xl p-5 ring-1 ring-primary-100 dark:ring-primary-500/20">
          <p className="text-xs font-medium text-primary-600 dark:text-primary-400 uppercase tracking-wide mb-1">Amount</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{formatCurrency(expense.amount)}</p>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {detailItems.map((item, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/80 dark:bg-[#2C2C2E]/50">
              <div className="p-2 rounded-lg bg-white dark:bg-[#1C1C1E] shadow-sm ring-1 ring-gray-100 dark:ring-[#38383A]/40">
                <item.icon className="h-4 w-4 text-gray-500 dark:text-[#8E8E93]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-gray-400 dark:text-[#636366] uppercase tracking-wider">{item.label}</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Description */}
        {expense.description && (
          <div>
            <p className="label mb-2">Description</p>
            <div className="text-sm text-gray-600 dark:text-[#8E8E93] bg-gray-50 dark:bg-[#2C2C2E] rounded-xl p-4 ring-1 ring-gray-100 dark:ring-[#38383A]/40 leading-relaxed">
              {expense.description}
            </div>
          </div>
        )}

        {/* Rejection reason */}
        {expense.rejectionReason && (
          <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-4 ring-1 ring-red-100 dark:ring-red-900/20">
            <p className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide mb-1">Rejection Reason</p>
            <p className="text-sm text-red-600 dark:text-red-300">{expense.rejectionReason}</p>
          </div>
        )}

        {/* Reject input */}
        {showRejectInput && (
          <div className="space-y-3 p-4 bg-red-50/50 dark:bg-red-900/5 rounded-xl ring-1 ring-red-100 dark:ring-red-900/20">
            <label className="label text-red-700 dark:text-red-400">Reason for rejection</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="input"
              rows={2}
              placeholder="Reason for rejection (optional)"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={handleReject} disabled={processing} className="btn btn-sm btn-danger text-xs">
                Confirm Reject
              </button>
              <button onClick={() => setShowRejectInput(false)} className="btn btn-sm btn-outline text-xs">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100 dark:border-[#2C2C2E]">
          {expense.status === 'Pending' && !showRejectInput && (
            <>
              <button onClick={handleApprove} disabled={processing} className="btn btn-sm bg-emerald-600 text-white hover:bg-emerald-500 shadow-md">
                <Check className="h-3.5 w-3.5 mr-1.5" />
                Approve
              </button>
              <button onClick={() => setShowRejectInput(true)} disabled={processing} className="btn btn-sm btn-danger">
                <Ban className="h-3.5 w-3.5 mr-1.5" />
                Reject
              </button>
            </>
          )}
          <div className="flex-1" />
          <button onClick={() => onEdit(expense)} className="btn btn-sm btn-outline">
            <Edit className="h-3.5 w-3.5 mr-1.5" />
            Edit
          </button>
          <button onClick={handleDelete} className="btn btn-sm bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/10 dark:text-red-400 dark:hover:bg-red-900/20 ring-1 ring-red-100 dark:ring-red-900/20">
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Delete
          </button>
        </div>
      </div>
    </ModalWrapper>
  )
}

export default ExpenseDetailModal
