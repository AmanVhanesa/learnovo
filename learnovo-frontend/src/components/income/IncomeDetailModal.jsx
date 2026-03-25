import React from 'react'
import { Calendar, CreditCard, User, FileText, Clock, Edit, Trash2 } from 'lucide-react'
import ModalWrapper from '../ModalWrapper'
import { formatCurrency } from '../../utils/formatCurrency'

const IncomeDetailModal = ({ income, onClose, onEdit, onDelete }) => {
  if (!income) return null

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this income record?')) return
    await onDelete(income._id)
  }

  const detailItems = [
    {
      icon: Calendar,
      label: 'Date',
      value: new Date(income.incomeDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    },
    {
      icon: CreditCard,
      label: 'Payment Method',
      value: income.paymentMethod
    },
    income.paymentReference && {
      icon: FileText,
      label: 'Reference',
      value: income.paymentReference
    },
    income.receivedBy && {
      icon: User,
      label: 'Received By',
      value: income.receivedBy
    },
    {
      icon: User,
      label: 'Added By',
      value: income.addedBy?.name || '—'
    },
    {
      icon: Clock,
      label: 'Created',
      value: new Date(income.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    }
  ].filter(Boolean)

  return (
    <ModalWrapper title="Income Details" onClose={onClose} maxWidth="max-w-2xl">
      <div className="p-6 space-y-6">
        {/* Header: Title + Category */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 mb-1">
            {income.category && (
              <span
                className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-white dark:ring-dark-card"
                style={{ backgroundColor: income.category.color || '#6B7280' }}
              />
            )}
            <span className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide">
              {income.category?.name || 'Uncategorized'}
            </span>
          </div>
          <h4 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">{income.title}</h4>
        </div>

        {/* Amount card */}
        <div className="bg-gradient-to-r from-emerald-50 to-emerald-50/30 dark:from-emerald-500/10 dark:to-emerald-500/5 rounded-xl p-5 ring-1 ring-emerald-100 dark:ring-emerald-500/20">
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1">Amount</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{formatCurrency(income.amount)}</p>
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
        {income.description && (
          <div>
            <p className="label mb-2">Description</p>
            <div className="text-sm text-gray-600 dark:text-[#8E8E93] bg-gray-50 dark:bg-[#2C2C2E] rounded-xl p-4 ring-1 ring-gray-100 dark:ring-[#38383A]/40 leading-relaxed">
              {income.description}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100 dark:border-[#2C2C2E]">
          <div className="flex-1" />
          <button onClick={() => onEdit(income)} className="btn btn-sm btn-outline">
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

export default IncomeDetailModal
