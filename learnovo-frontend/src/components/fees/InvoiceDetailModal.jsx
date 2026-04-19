import React from 'react'
import { FileText, Printer, Download, DollarSign, Tag, Calendar, User, Hash, Edit } from 'lucide-react'
import { formatCurrency } from '../../utils/formatCurrency'
import StatusBadge from '../StatusBadge'
import ModalWrapper from '../ModalWrapper'

const InvoiceDetailModal = ({ invoice, onClose, onCollectPayment, onPrintReceipt, onDownloadReceipt, onApplyDiscount, onEdit }) => {
  if (!invoice) return null

  const student = invoice.studentId || {}
  const payments = invoice.payments || []
  const paidAmount = invoice.paidAmount || 0
  const progressPercent = invoice.totalAmount > 0
    ? Math.round((paidAmount / invoice.totalAmount) * 100)
    : 0

  const studentName = student.fullName || student.name || ''
  const initials = studentName ? studentName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : '?'

  return (
    <ModalWrapper title={`Invoice ${invoice.invoiceNumber}`} onClose={onClose} maxWidth="max-w-3xl">
      <div className="p-4 sm:p-6 space-y-6">
        {/* Header summary */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-[#2C2C2E] flex items-center justify-center flex-shrink-0 border border-primary-200/50 dark:border-[#38383A]">
              <span className="text-sm font-bold text-primary-700 dark:text-[#3EC4B1]">{initials}</span>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white text-base">
                {studentName || 'Unknown Student'}
              </h4>
              <p className="text-sm text-gray-500 dark:text-[#8E8E93]">
                {student.admissionNumber || student.studentId || ''} {invoice.classId?.name ? `- ${invoice.classId.name}` : ''}
              </p>
            </div>
          </div>
          <StatusBadge status={invoice.status} />
        </div>

        {/* Amount breakdown cards — explicit colors, no dynamic classes */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 bg-gray-50 dark:bg-[#2C2C2E] rounded-xl border border-gray-100 dark:border-[#38383A]">
            <p className="text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide">Total</p>
            <p className="text-lg font-bold mt-1 text-gray-900 dark:text-white">{formatCurrency(invoice.totalAmount)}</p>
          </div>
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
            <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Paid</p>
            <p className="text-lg font-bold mt-1 text-emerald-700 dark:text-emerald-400">{formatCurrency(paidAmount)}</p>
          </div>
          <div className="p-3.5 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
            <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Discount</p>
            <p className="text-lg font-bold mt-1 text-blue-700 dark:text-blue-400">{formatCurrency(invoice.discountAmount || 0)}</p>
          </div>
          <div className={`p-3.5 rounded-xl border ${
            (invoice.balanceAmount || 0) > 0
              ? 'bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/30'
              : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30'
          }`}>
            <p className={`text-[11px] font-semibold uppercase tracking-wide ${
              (invoice.balanceAmount || 0) > 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}>Balance</p>
            <p className={`text-lg font-bold mt-1 ${
              (invoice.balanceAmount || 0) > 0
                ? 'text-red-700 dark:text-red-400'
                : 'text-emerald-700 dark:text-emerald-400'
            }`}>{formatCurrency(invoice.balanceAmount || 0)}</p>
          </div>
        </div>

        {/* Payment progress bar */}
        <div className="p-4 bg-gray-50 dark:bg-[#2C2C2E] rounded-xl border border-gray-100 dark:border-[#38383A]">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-sm font-medium text-gray-700 dark:text-[#8E8E93]">Payment Progress</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">{progressPercent}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 dark:bg-[#38383A] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                progressPercent >= 100
                  ? 'bg-emerald-500 dark:bg-emerald-400'
                  : progressPercent > 0
                    ? 'bg-amber-500 dark:bg-amber-400'
                    : 'bg-gray-300 dark:bg-[#48484A]'
              }`}
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-400 dark:text-[#636366]">
            <span>Paid: {formatCurrency(paidAmount)}</span>
            <span>Total: {formatCurrency(invoice.totalAmount)}</span>
          </div>
        </div>

        {/* Invoice details */}
        <div className="bg-gray-50 dark:bg-[#2C2C2E] rounded-xl border border-gray-100 dark:border-[#38383A] divide-y divide-gray-100 dark:divide-[#38383A]">
          <div className="p-4">
            <h5 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Hash className="h-4 w-4 text-gray-400" /> Invoice Details
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between sm:flex-col">
                <span className="text-gray-500 dark:text-[#8E8E93]">Invoice Number</span>
                <span className="font-mono font-semibold text-gray-900 dark:text-white">{invoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between sm:flex-col">
                <span className="text-gray-500 dark:text-[#8E8E93]">Due Date</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                </span>
              </div>
              <div className="flex justify-between sm:flex-col">
                <span className="text-gray-500 dark:text-[#8E8E93]">Billing Period</span>
                <span className="font-medium text-gray-900 dark:text-white">{invoice.billingPeriod?.displayText || '-'}</span>
              </div>
              <div className="flex justify-between sm:flex-col">
                <span className="text-gray-500 dark:text-[#8E8E93]">Created</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Fee heads breakdown */}
          {invoice.items?.length > 0 && (
            <div className="p-4">
              <h5 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" /> Fee Breakdown
              </h5>
              <div className="space-y-2">
                {invoice.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 px-3 bg-white dark:bg-[#1C1C1E] rounded-lg">
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{item.feeHeadName || item.name}</span>
                      {item.frequency && item.frequency.toLowerCase() === 'one-time' && (
                        <span className="ml-2 px-1.5 py-0.5 text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">ONE TIME</span>
                      )}
                      {item.frequency && item.frequency.toLowerCase() !== 'one-time' && (
                        <span className="ml-2 text-xs text-gray-400 dark:text-[#636366] capitalize">({item.frequency})</span>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between py-2 px-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-100 dark:border-primary-800/30">
                  <span className="text-sm font-semibold text-primary-700 dark:text-primary-400">Total</span>
                  <span className="text-sm font-bold text-primary-700 dark:text-primary-400">{formatCurrency(invoice.totalAmount)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Discount info */}
          {(invoice.discountAmount > 0 || invoice.discount) && (
            <div className="p-4">
              <h5 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <Tag className="h-4 w-4 text-gray-400" /> Discount Applied
              </h5>
              <div className="flex items-center justify-between py-2 px-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800/30">
                <div>
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">
                    {invoice.discount?.type || 'Discount'}
                  </span>
                  {invoice.discount?.reason && (
                    <p className="text-xs text-green-600 dark:text-green-400/80 mt-0.5">{invoice.discount.reason}</p>
                  )}
                </div>
                <span className="text-sm font-bold text-green-700 dark:text-green-400">
                  - {formatCurrency(invoice.discountAmount || invoice.discount?.amount || 0)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Payment history */}
        {payments.length > 0 && (
          <div>
            <h5 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-gray-400" /> Payment History
            </h5>
            <div className="space-y-2">
              {payments.map((p) => (
                <div key={p._id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#2C2C2E] rounded-xl border border-gray-100 dark:border-[#38383A]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(p.amount)}</span>
                      <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded-full">
                        {p.status || 'Paid'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-1">
                      {new Date(p.paymentDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} &bull; {p.paymentMethod}
                    </p>
                    {p.receiptNumber && (
                      <p className="text-xs text-gray-400 dark:text-[#636366]">Receipt: {p.receiptNumber}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {onPrintReceipt && (
                      <button onClick={() => onPrintReceipt(p._id)} className="btn-icon !p-1.5 !rounded-lg" title="Print Receipt">
                        <Printer className="h-4 w-4" />
                      </button>
                    )}
                    {onDownloadReceipt && (
                      <button onClick={() => onDownloadReceipt(p._id)} className="btn-icon !p-1.5 !rounded-lg" title="Download Receipt">
                        <Download className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Remarks */}
        {invoice.remarks && (
          <div className="p-3 bg-gray-50 dark:bg-[#2C2C2E] rounded-xl border border-gray-100 dark:border-[#38383A]">
            <p className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] mb-1">Remarks</p>
            <p className="text-sm text-gray-700 dark:text-white">{invoice.remarks}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-5 border-t border-gray-100 dark:border-[#38383A]">
          <button onClick={onClose} className="btn btn-outline w-full sm:w-auto">
            Close
          </button>
          {onApplyDiscount && invoice.status !== 'Paid' && !invoice.discountAmount && (
            <button
              onClick={() => onApplyDiscount(invoice)}
              className="btn w-full sm:w-auto bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/30 dark:hover:bg-blue-900/30"
            >
              <Tag className="h-4 w-4 mr-2" /> Apply Discount
            </button>
          )}
          {onEdit && invoice.status !== 'Cancelled' && (
            <button onClick={() => onEdit(invoice)} className="btn btn-outline w-full sm:w-auto">
              <Edit className="h-4 w-4 mr-2" /> Edit
            </button>
          )}
          {onCollectPayment && (invoice.status === 'Pending' || invoice.status === 'Partial' || invoice.status === 'Overdue') && (
            <button onClick={() => onCollectPayment(invoice)} className="btn btn-primary w-full sm:w-auto">
              <DollarSign className="h-4 w-4 mr-2" /> Collect Payment
            </button>
          )}
        </div>
      </div>
    </ModalWrapper>
  )
}

export default InvoiceDetailModal
