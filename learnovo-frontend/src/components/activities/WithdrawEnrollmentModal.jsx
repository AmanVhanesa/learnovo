import React, { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { AlertTriangle, IndianRupee } from 'lucide-react'
import ModalWrapper from '../ModalWrapper'
import Button from '../Button'
import LoadingSpinner from '../LoadingSpinner'
import StatusBadge from '../StatusBadge'
import { activityEnrollmentsService } from '../../services/activityProgramsService'
import { formatCurrency } from '../../utils/formatCurrency'

const WithdrawEnrollmentModal = ({ enrollment, onClose, onWithdrawn }) => {
  const [reason, setReason] = useState('')
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10))
  const [settlementMode, setSettlementMode] = useState('none')
  const [discountAmount, setDiscountAmount] = useState('')
  const [cancelOnlyUnpaid, setCancelOnlyUnpaid] = useState(true)
  const [outstanding, setOutstanding] = useState({ invoices: [], totalOutstanding: 0 })
  const [loadingOutstanding, setLoadingOutstanding] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoadingOutstanding(true)
    activityEnrollmentsService.outstanding(enrollment._id)
      .then(res => { if (!cancelled) setOutstanding(res.data || { invoices: [], totalOutstanding: 0 }) })
      .catch(() => { if (!cancelled) setOutstanding({ invoices: [], totalOutstanding: 0 }) })
      .finally(() => { if (!cancelled) setLoadingOutstanding(false) })
    return () => { cancelled = true }
  }, [enrollment._id])

  const remainingAfterDiscount = useMemo(() => {
    if (settlementMode !== 'discount') return outstanding.totalOutstanding
    const d = Number(discountAmount) || 0
    return Math.max(0, outstanding.totalOutstanding - d)
  }, [settlementMode, discountAmount, outstanding.totalOutstanding])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (settlementMode === 'discount') {
      const d = Number(discountAmount)
      if (!d || d <= 0) return toast.error('Enter a positive discount amount')
    }

    setSaving(true)
    try {
      const res = await activityEnrollmentsService.withdraw(enrollment._id, {
        reason: reason.trim() || undefined,
        endDate,
        settlementMode,
        discountAmount: settlementMode === 'discount' ? Number(discountAmount) : undefined,
        cancelOnlyUnpaid: settlementMode === 'cancel' ? cancelOnlyUnpaid : undefined
      })
      toast.success('Student withdrawn from activity')
      onWithdrawn?.(res.data)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to withdraw')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalWrapper title="Withdraw from Activity" onClose={onClose} maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="p-5 space-y-5">
        <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-medium text-amber-900 dark:text-amber-200">
              {enrollment.student?.name || 'Student'} will be withdrawn from {enrollment.activityProgram?.name || 'this activity'}.
            </div>
            <div className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              Future monthly invoices will stop. Use settlement options below to handle outstanding fees.
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">End Date</label>
            <input type="date" className="input" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Reason</label>
            <input type="text" className="input" maxLength={300} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Schedule conflict" />
          </div>
        </div>

        {/* Outstanding summary */}
        <div className="border border-gray-100 dark:border-[#2C2C2E] rounded-xl">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-[#2C2C2E] flex items-center justify-between">
            <div className="text-sm font-medium text-gray-700 dark:text-white">Outstanding invoices</div>
            <div className="text-sm font-semibold text-gray-900 dark:text-white inline-flex items-center">
              <IndianRupee className="w-4 h-4 mr-1" />
              {formatCurrency(outstanding.totalOutstanding).replace('₹', '')}
            </div>
          </div>
          {loadingOutstanding ? (
            <div className="p-4"><LoadingSpinner /></div>
          ) : outstanding.invoices.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-[#8E8E93]">No outstanding invoices — clean withdrawal.</div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-[#2C2C2E]">
              {outstanding.invoices.map(inv => (
                <li key={inv._id} className="px-4 py-2 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium text-gray-800 dark:text-white">{inv.invoiceNumber}</div>
                    <div className="text-xs text-gray-500 dark:text-[#8E8E93]">{inv.periodLabel || inv.billingPeriod?.displayText}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={inv.status} />
                    <div className="text-right">
                      <div className="font-semibold text-gray-900 dark:text-white">{formatCurrency(inv.balanceAmount)}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Settlement options (only when there are outstanding invoices) */}
        {outstanding.invoices.length > 0 && (
          <div>
            <div className="label !mb-2">How do you want to settle the outstanding?</div>
            <div className="space-y-2">
              {[
                { id: 'none', title: 'Leave as is', desc: 'Outstanding invoices remain due and can be paid normally.' },
                { id: 'discount', title: 'Apply a discount', desc: 'Reduce the outstanding by a fixed amount; collect the rest.' },
                { id: 'cancel', title: 'Cancel outstanding invoices', desc: 'Cancel unpaid invoices. Partial-paid ones (with money already collected) can be kept.' }
              ].map(opt => (
                <label key={opt.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${settlementMode === opt.id ? 'border-primary-300 bg-primary-50/60 dark:bg-primary-900/20 dark:border-primary-700' : 'border-gray-200 dark:border-[#38383A] hover:bg-gray-50 dark:hover:bg-[#2C2C2E]'}`}>
                  <input
                    type="radio" name="settlementMode" className="mt-1"
                    checked={settlementMode === opt.id}
                    onChange={() => setSettlementMode(opt.id)}
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{opt.title}</div>
                    <div className="text-xs text-gray-500 dark:text-[#8E8E93]">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            {settlementMode === 'discount' && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Discount Amount (₹)</label>
                  <input
                    type="number" min="0" className="input"
                    value={discountAmount} onChange={e => setDiscountAmount(e.target.value)}
                    placeholder={`Max ${formatCurrency(outstanding.totalOutstanding)}`}
                  />
                </div>
                <div className="flex items-end">
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl px-3 py-2 w-full">
                    <div className="text-xs text-gray-500 dark:text-[#8E8E93]">Student still owes</div>
                    <div className="text-lg font-semibold text-emerald-700 dark:text-emerald-400">{formatCurrency(remainingAfterDiscount)}</div>
                  </div>
                </div>
              </div>
            )}

            {settlementMode === 'cancel' && (
              <label className="mt-3 flex items-center gap-2 text-sm text-gray-700 dark:text-[#8E8E93]">
                <input type="checkbox" checked={cancelOnlyUnpaid} onChange={e => setCancelOnlyUnpaid(e.target.checked)} />
                Only cancel invoices that have no payment yet (recommended)
              </label>
            )}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-gray-100 dark:border-[#2C2C2E]">
          <Button variant="ghost" type="button" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="danger" type="submit" loading={saving}>Withdraw Student</Button>
        </div>
      </form>
    </ModalWrapper>
  )
}

export default WithdrawEnrollmentModal
