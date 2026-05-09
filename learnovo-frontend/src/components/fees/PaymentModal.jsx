import React, { useState, useEffect, useMemo } from 'react'
import { AlertCircle, History, Printer, Tag, ChevronDown, ChevronUp, IndianRupee, CreditCard, Banknote, Smartphone, Building2, FileCheck, Globe, Download, CheckCircle2, Pencil, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { paymentsService, discountsService } from '../../services/feesService'
import { formatCurrency } from '../../utils/formatCurrency'
import StatusBadge from '../StatusBadge'
import ModalWrapper from '../ModalWrapper'

const preventScrollChange = (e) => e.target.blur()

const DISCOUNT_TYPES = ['Scholarship', 'Sibling Discount', 'Staff Ward', 'Merit-based', 'Financial Hardship', 'Other']

const PAYMENT_METHODS = [
  { value: 'Cash', label: 'Cash', icon: Banknote },
  { value: 'UPI', label: 'UPI', icon: Smartphone },
  { value: 'Bank Transfer', label: 'Bank Transfer', icon: Building2 },
  { value: 'Cheque', label: 'Cheque', icon: FileCheck },
  { value: 'Card', label: 'Card', icon: CreditCard },
  { value: 'Online', label: 'Online', icon: Globe },
]

const PaymentModal = ({ student, invoices, payments = [], onPrintReceipt, onDownloadReceipt, onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState('collect')
  const [collectMode, setCollectMode] = useState('single') // 'single' | 'multi'
  const [selectedQuarter, setSelectedQuarter] = useState('all')
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [bulkSelected, setBulkSelected] = useState({}) // { [invoiceId]: { checked, amount } }
  const [form, setForm] = useState({
    amount: '',
    paymentMethod: 'Cash',
    paymentDate: new Date().toISOString().split('T')[0],
    transactionDetails: {},
    remarks: '',
    depositorName: '',
  })
  const [isSaving, setIsSaving] = useState(false)

  // Inline discount state
  const [showDiscount, setShowDiscount] = useState(false)
  const [discountMode, setDiscountMode] = useState('fixed')
  const [discountForm, setDiscountForm] = useState({ type: '', amount: '', percentage: '', reason: '' })
  const [isApplyingDiscount, setIsApplyingDiscount] = useState(false)
  const [isEditingDiscount, setIsEditingDiscount] = useState(false)
  const [isRemovingDiscount, setIsRemovingDiscount] = useState(false)
  const [applyDiscountToAll, setApplyDiscountToAll] = useState(false)

  // Post-collection success view (popup-within-modal for receipt printing)
  const [collectedResult, setCollectedResult] = useState(null) // { payments: [{_id, receiptNumber, amount}], totalAmount }

  // Extract unique periods/quarters from invoices for filtering (sorted chronologically)
  const periodOptions = useMemo(() => {
    const periods = []
    const seen = new Set()
    invoices.forEach(inv => {
      const label = inv.periodLabel || inv.billingPeriod?.displayText || ''
      if (label && !seen.has(label)) {
        seen.add(label)
        periods.push({
          value: label,
          label,
          sortKey: new Date(inv.periodStart || inv.billingPeriod?.startDate || inv.dueDate || 0).getTime() || 0,
        })
      }
    })
    periods.sort((a, b) => a.sortKey - b.sortKey)
    return periods.map(({ sortKey, ...rest }) => rest) // eslint-disable-line no-unused-vars
  }, [invoices])

  // Filter invoices by selected period, sorted chronologically (Q1 → Q4)
  const filteredInvoices = useMemo(() => {
    const list = selectedQuarter === 'all'
      ? invoices
      : invoices.filter(inv => (inv.periodLabel || inv.billingPeriod?.displayText || '') === selectedQuarter)
    return [...list].sort((a, b) => {
      const ka = new Date(a.periodStart || a.billingPeriod?.startDate || a.dueDate || 0).getTime() || 0
      const kb = new Date(b.periodStart || b.billingPeriod?.startDate || b.dueDate || 0).getTime() || 0
      return ka - kb
    })
  }, [invoices, selectedQuarter])

  useEffect(() => {
    if (invoices.length === 0 && payments.length > 0) {
      setActiveTab('history')
    } else if (invoices.length > 0) {
      setActiveTab('collect')
      setSelectedInvoice(invoices[0])
      setForm(f => ({ ...f, amount: invoices[0].balanceAmount || '' }))
    }
  }, [invoices, payments])

  // When quarter filter changes, auto-select first filtered invoice
  useEffect(() => {
    if (filteredInvoices.length > 0) {
      setSelectedInvoice(filteredInvoices[0])
      setForm(f => ({ ...f, amount: filteredInvoices[0].balanceAmount || '' }))
    } else {
      setSelectedInvoice(null)
      setForm(f => ({ ...f, amount: '' }))
    }
  }, [selectedQuarter]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset discount when invoice changes
  useEffect(() => {
    setShowDiscount(false)
    setDiscountForm({ type: '', amount: '', percentage: '', reason: '' })
    setApplyDiscountToAll(false)
  }, [selectedInvoice?._id])

  const discountCalcAmount = useMemo(() => {
    if (discountMode === 'percentage') {
      return Math.round((parseFloat(discountForm.percentage || 0) / 100) * (selectedInvoice?.totalAmount || 0))
    }
    return parseFloat(discountForm.amount || 0)
  }, [discountMode, discountForm.percentage, discountForm.amount, selectedInvoice?.totalAmount])

  const effectiveBalance = useMemo(() => {
    if (!selectedInvoice) return 0
    const base = selectedInvoice.balanceAmount || 0
    return Math.max(0, base - (showDiscount && discountCalcAmount > 0 ? discountCalcAmount : 0))
  }, [selectedInvoice, showDiscount, discountCalcAmount])

  const paymentProgress = useMemo(() => {
    if (!selectedInvoice || !selectedInvoice.totalAmount) return 0
    return Math.min(100, Math.round(((selectedInvoice.paidAmount || 0) / selectedInvoice.totalAmount) * 100))
  }, [selectedInvoice])

  const handleApplyDiscount = async () => {
    if (!selectedInvoice) return
    if (!discountForm.type) { toast.error('Select a discount type'); return }
    if (!discountForm.reason.trim()) { toast.error('Provide a reason'); return }

    // Bulk apply across all filtered invoices
    if (applyDiscountToAll && filteredInvoices.length > 1) {
      if (discountMode === 'percentage') {
        const pct = parseFloat(discountForm.percentage)
        if (!pct || pct <= 0 || pct > 100) { toast.error('Enter a valid percentage'); return }
      } else {
        const amt = parseFloat(discountForm.amount)
        if (!amt || amt <= 0) { toast.error('Enter a valid discount amount'); return }
      }

      try {
        setIsApplyingDiscount(true)
        const reason = discountForm.reason.trim()
        let success = 0
        const failures = []
        for (const inv of filteredInvoices) {
          try {
            const perInvoiceAmount = discountMode === 'percentage'
              ? Math.round((parseFloat(discountForm.percentage) / 100) * (inv.totalAmount || 0))
              : Math.min(parseFloat(discountForm.amount), inv.totalAmount || 0)
            if (perInvoiceAmount <= 0) continue

            // Remove existing discount on this invoice (if any) so re-apply doesn't get rejected
            if (inv.discountAmount > 0) {
              await discountsService.removeDiscount(inv._id)
            }
            const payload = {
              type: discountForm.type,
              reason,
              amount: perInvoiceAmount,
            }
            if (discountMode === 'percentage') {
              payload.percentage = parseFloat(discountForm.percentage)
            }
            await discountsService.applyDiscount(inv._id, payload)
            success++
          } catch (err) {
            failures.push(inv.invoiceNumber || inv._id)
          }
        }
        if (success > 0) {
          toast.success(`Discount applied to ${success} invoice${success > 1 ? 's' : ''}${failures.length ? ` (${failures.length} failed)` : ''}`)
          // Refresh parent data so updated balances/discounts reflect everywhere
          onSuccess()
        } else {
          toast.error('Failed to apply discount to any invoice')
        }
      } finally {
        setIsApplyingDiscount(false)
      }
      return
    }

    if (discountCalcAmount <= 0) { toast.error('Enter a valid discount amount'); return }
    if (discountCalcAmount > selectedInvoice.totalAmount) { toast.error('Discount exceeds total amount'); return }

    try {
      setIsApplyingDiscount(true)
      // If editing, remove the existing discount first (backend rejects re-apply otherwise)
      const previousDiscount = isEditingDiscount ? (selectedInvoice.discountAmount || 0) : 0
      if (isEditingDiscount && previousDiscount > 0) {
        await discountsService.removeDiscount(selectedInvoice._id)
      }
      const payload = {
        type: discountForm.type,
        reason: discountForm.reason.trim(),
        amount: discountCalcAmount,
      }
      if (discountMode === 'percentage') {
        payload.percentage = parseFloat(discountForm.percentage)
      }
      await discountsService.applyDiscount(selectedInvoice._id, payload)
      toast.success(isEditingDiscount ? 'Discount updated' : 'Discount applied successfully')
      // Re-derive balance: restore previous discount, then subtract new
      const baseBalance = (selectedInvoice.balanceAmount || 0) + previousDiscount
      const newBalance = Math.max(0, baseBalance - discountCalcAmount)
      setSelectedInvoice(inv => ({ ...inv, balanceAmount: newBalance, discountAmount: discountCalcAmount, discountType: discountForm.type, discountReason: discountForm.reason.trim() }))
      setForm(f => ({ ...f, amount: newBalance }))
      setShowDiscount(false)
      setIsEditingDiscount(false)
      setDiscountForm({ type: '', amount: '', percentage: '', reason: '' })
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to apply discount')
    } finally {
      setIsApplyingDiscount(false)
    }
  }

  const handleRemoveDiscount = async () => {
    if (!selectedInvoice || !(selectedInvoice.discountAmount > 0)) return
    if (!window.confirm('Remove the applied discount from this invoice?')) return
    try {
      setIsRemovingDiscount(true)
      const previousDiscount = selectedInvoice.discountAmount || 0
      await discountsService.removeDiscount(selectedInvoice._id)
      toast.success('Discount removed')
      const newBalance = (selectedInvoice.balanceAmount || 0) + previousDiscount
      setSelectedInvoice(inv => ({ ...inv, balanceAmount: newBalance, discountAmount: 0, discountType: undefined, discountReason: undefined }))
      setForm(f => ({ ...f, amount: newBalance }))
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to remove discount')
    } finally {
      setIsRemovingDiscount(false)
    }
  }

  const handleEditDiscount = () => {
    if (!selectedInvoice) return
    const amt = selectedInvoice.discountAmount || 0
    setDiscountForm({
      type: selectedInvoice.discountType || '',
      amount: String(amt),
      percentage: '',
      reason: selectedInvoice.discountReason || '',
    })
    setDiscountMode('fixed')
    setIsEditingDiscount(true)
    setShowDiscount(true)
  }

  // Initialize/refresh bulk selection state when entering multi-mode or when filtered invoices change
  useEffect(() => {
    if (collectMode !== 'multi') return
    setBulkSelected(prev => {
      const next = {}
      filteredInvoices.forEach(inv => {
        const existing = prev[inv._id]
        next[inv._id] = existing
          ? { checked: existing.checked, amount: existing.amount }
          : { checked: false, amount: String(inv.balanceAmount || 0) }
      })
      return next
    })
  }, [collectMode, filteredInvoices])

  const bulkTotal = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => {
      const row = bulkSelected[inv._id]
      if (!row?.checked) return sum
      return sum + (parseFloat(row.amount) || 0)
    }, 0)
  }, [filteredInvoices, bulkSelected])

  const bulkSelectedCount = useMemo(
    () => Object.values(bulkSelected).filter(r => r?.checked).length,
    [bulkSelected]
  )

  const handleBulkSubmit = async (e) => {
    e.preventDefault()
    const items = filteredInvoices
      .filter(inv => bulkSelected[inv._id]?.checked)
      .map(inv => ({
        invoiceId: inv._id,
        amount: parseFloat(bulkSelected[inv._id].amount) || 0,
        balance: inv.balanceAmount || 0,
        invoiceNumber: inv.invoiceNumber,
      }))

    if (items.length === 0) { toast.error('Select at least one invoice'); return }
    for (const it of items) {
      if (!it.amount || it.amount <= 0) { toast.error(`Enter a valid amount for ${it.invoiceNumber}`); return }
      if (it.amount > it.balance + 0.01) { toast.error(`Amount exceeds balance for ${it.invoiceNumber}`); return }
    }

    try {
      setIsSaving(true)
      const res = await paymentsService.collectBulk({
        studentId: student._id,
        items: items.map(({ invoiceId, amount }) => ({ invoiceId, amount })),
        paymentMethod: form.paymentMethod,
        paymentDate: form.paymentDate,
        transactionDetails: form.transactionDetails,
        remarks: form.remarks,
        depositorName: form.depositorName.trim(),
      })
      toast.success(`Collected payment for ${items.length} invoice(s)`)
      const collected = (res?.data?.payments || []).map(p => ({
        _id: p._id,
        receiptNumber: p.receiptNumber,
        amount: p.amount,
        invoiceNumber: p.invoiceNumber,
      }))
      if (collected.length > 0) {
        setCollectedResult({ payments: collected, totalAmount: res?.data?.totalAmount || items.reduce((s, i) => s + i.amount, 0) })
      } else {
        onSuccess()
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to collect payment')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedInvoice) { toast.error('Please select an invoice'); return }

    const amount = parseFloat(form.amount)
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return }
    if (amount > (selectedInvoice.balanceAmount || 0)) {
      toast.error('Amount exceeds balance')
      return
    }

    try {
      setIsSaving(true)
      const res = await paymentsService.collect({
        studentId: student._id,
        invoiceId: selectedInvoice._id,
        amount,
        paymentMethod: form.paymentMethod,
        paymentDate: form.paymentDate,
        transactionDetails: form.transactionDetails,
        remarks: form.remarks,
        depositorName: form.depositorName.trim(),
      })
      const p = res?.data?.payment
      if (p?._id) {
        setCollectedResult({
          payments: [{
            _id: p._id,
            receiptNumber: p.receiptNumber,
            amount: p.amount,
            invoiceNumber: selectedInvoice.invoiceNumber,
          }],
          totalAmount: p.amount,
        })
      } else {
        onSuccess()
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to collect payment')
    } finally {
      setIsSaving(false)
    }
  }

  const tabClass = (tab) => `flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors ${
    activeTab === tab
      ? 'border-primary-500 text-primary-600 dark:text-primary-400 dark:border-primary-400'
      : 'border-transparent text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white'
  }`

  if (collectedResult) {
    const single = collectedResult.payments.length === 1
    return (
      <ModalWrapper title="Payment Collected" onClose={onSuccess}>
        <div className="p-6 sm:p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-9 w-9 text-emerald-500 dark:text-emerald-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Payment Collected Successfully</h3>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93] mb-5">
            {formatCurrency(collectedResult.totalAmount)} • {collectedResult.payments.length} receipt{single ? '' : 's'}
          </p>

          <div className="space-y-2 mb-6 text-left">
            {collectedResult.payments.map((p) => (
              <div key={p._id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#2C2C2E] rounded-xl border border-gray-100 dark:border-[#38383A]">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(p.amount)}</p>
                  {p.receiptNumber && (
                    <p className="text-[11px] text-gray-400 dark:text-[#636366] font-mono">Receipt: {p.receiptNumber}</p>
                  )}
                  {p.invoiceNumber && (
                    <p className="text-[11px] text-gray-400 dark:text-[#636366] truncate">Invoice: {p.invoiceNumber}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {onPrintReceipt && (
                    <button onClick={() => onPrintReceipt(p._id)} className="btn-icon !p-2" title="Print Receipt">
                      <Printer className="h-4 w-4" />
                    </button>
                  )}
                  {onDownloadReceipt && (
                    <button onClick={() => onDownloadReceipt(p._id)} className="btn-icon !p-2" title="Download PDF">
                      <Download className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch justify-end gap-2 sm:gap-3 pt-4 border-t border-gray-100 dark:border-[#38383A]">
            <button type="button" onClick={onSuccess} className="btn btn-outline w-full sm:w-auto">Done</button>
            {single && onPrintReceipt && (
              <button
                type="button"
                onClick={() => onPrintReceipt(collectedResult.payments[0]._id)}
                className="btn btn-primary w-full sm:w-auto flex items-center justify-center gap-2"
              >
                <Printer className="h-4 w-4" /> Print Receipt
              </button>
            )}
          </div>
        </div>
      </ModalWrapper>
    )
  }

  return (
    <ModalWrapper title="Collect Fee Payment" onClose={onClose}>
      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-[#38383A]">
        <button className={tabClass('collect')} onClick={() => setActiveTab('collect')}>
          <span className="flex items-center justify-center gap-1.5">
            <IndianRupee className="h-3.5 w-3.5" /> Collect Payment
          </span>
        </button>
        <button className={tabClass('history')} onClick={() => setActiveTab('history')}>
          <span className="flex items-center justify-center gap-1.5">
            <History className="h-3.5 w-3.5" /> Payment History
            {payments.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-gray-200 dark:bg-[#38383A] text-gray-600 dark:text-[#8E8E93] rounded-full">
                {payments.length}
              </span>
            )}
          </span>
        </button>
      </div>

      {/* Collect Tab */}
      {activeTab === 'collect' && (
        <div className="p-4 sm:p-6">
          {invoices.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-7 w-7 text-emerald-500 dark:text-emerald-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">No Pending Invoices</h3>
              <p className="text-sm text-gray-500 dark:text-[#8E8E93]">This student has no pending dues. All fees are paid.</p>
            </div>
          ) : collectMode === 'multi' ? (
            <form onSubmit={handleBulkSubmit} className="space-y-5">
              {/* Student info */}
              <div className="flex items-center gap-3 p-3.5 bg-gray-50 dark:bg-[#2C2C2E] rounded-xl border border-gray-100 dark:border-[#38383A]">
                <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary-700 dark:text-primary-400">
                    {(student.fullName || student.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{student.fullName || student.name}</p>
                  <p className="text-xs text-gray-500 dark:text-[#636366]">
                    ID: {student.studentId || student.admissionNumber} &middot; Class: {student.classId?.name || student.class || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Mode toggle */}
              <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-[#38383A]">
                <button type="button" onClick={() => setCollectMode('single')} className="flex-1 py-2 text-xs font-medium bg-white dark:bg-[#1C1C1E] text-gray-500 dark:text-[#8E8E93]">
                  Single Invoice
                </button>
                <button type="button" className="flex-1 py-2 text-xs font-medium bg-primary-600 text-white dark:bg-primary-500">
                  Multiple Invoices
                </button>
              </div>

              {/* Bulk invoice list */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="label">Select Invoices *</label>
                  {filteredInvoices.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const allChecked = filteredInvoices.every(inv => bulkSelected[inv._id]?.checked)
                        setBulkSelected(prev => {
                          const next = { ...prev }
                          filteredInvoices.forEach(inv => {
                            next[inv._id] = { ...(next[inv._id] || { amount: String(inv.balanceAmount || 0) }), checked: !allChecked }
                          })
                          return next
                        })
                      }}
                      className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      {filteredInvoices.every(inv => bulkSelected[inv._id]?.checked) ? 'Deselect all' : 'Select all'}
                    </button>
                  )}
                </div>
                {filteredInvoices.length === 0 ? (
                  <div className="text-center py-4 bg-gray-50 dark:bg-[#2C2C2E] rounded-xl border border-gray-100 dark:border-[#38383A]">
                    <p className="text-sm text-gray-500 dark:text-[#8E8E93]">No pending invoices</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-[#38383A] border border-gray-100 dark:border-[#38383A] rounded-xl overflow-hidden">
                    {filteredInvoices.map((inv) => {
                      const row = bulkSelected[inv._id] || { checked: false, amount: String(inv.balanceAmount || 0) }
                      const period = inv.periodLabel || inv.billingPeriod?.displayText || ''
                      return (
                        <div key={inv._id} className={`px-3 py-2.5 flex items-center gap-3 ${row.checked ? 'bg-primary-50/40 dark:bg-primary-900/10' : 'bg-white dark:bg-[#1C1C1E]'}`}>
                          <input
                            type="checkbox"
                            checked={!!row.checked}
                            onChange={(e) => setBulkSelected(prev => ({
                              ...prev,
                              [inv._id]: { ...(prev[inv._id] || { amount: String(inv.balanceAmount || 0) }), checked: e.target.checked }
                            }))}
                            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                              {inv.invoiceNumber}{period ? ` — ${period}` : ''}
                            </p>
                            <p className="text-[11px] text-gray-500 dark:text-[#636366]">
                              Balance: {formatCurrency(inv.balanceAmount)} &middot; {inv.status}
                            </p>
                          </div>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            max={inv.balanceAmount}
                            disabled={!row.checked}
                            value={row.amount}
                            onWheel={preventScrollChange}
                            onChange={(e) => setBulkSelected(prev => ({
                              ...prev,
                              [inv._id]: { ...(prev[inv._id] || { checked: true }), amount: e.target.value }
                            }))}
                            className="input !py-1.5 !px-2 text-xs w-28 text-right"
                            placeholder="Amount"
                          />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Quarter / Period filter */}
              {periodOptions.length > 0 && (
                <div>
                  <label className="label mb-1.5 block">Filter by Period</label>
                  <div className="flex flex-wrap gap-2">
                    {periodOptions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setSelectedQuarter('all')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border-2 transition-all ${
                          selectedQuarter === 'all'
                            ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400 dark:border-primary-400'
                            : 'border-gray-200 dark:border-[#38383A] text-gray-600 dark:text-[#8E8E93]'
                        }`}
                      >
                        All ({invoices.length})
                      </button>
                    )}
                    {periodOptions.map((period) => {
                      const count = invoices.filter(inv => (inv.periodLabel || inv.billingPeriod?.displayText || '') === period.value).length
                      return (
                        <button
                          key={period.value}
                          type="button"
                          onClick={() => setSelectedQuarter(period.value)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border-2 transition-all ${
                            selectedQuarter === period.value
                              ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400 dark:border-primary-400'
                              : 'border-gray-200 dark:border-[#38383A] text-gray-600 dark:text-[#8E8E93]'
                          }`}
                        >
                          {period.label} ({count})
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Payment method */}
              <div>
                <label className="label mb-1.5 block">Payment Method *</label>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map((method) => {
                    const Icon = method.icon
                    const isSelected = form.paymentMethod === method.value
                    return (
                      <button
                        key={method.value}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, paymentMethod: method.value, transactionDetails: {} }))}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${
                          isSelected
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-400'
                            : 'border-gray-200 dark:border-[#38383A]'
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${isSelected ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`} />
                        <span className={`text-xs font-medium ${isSelected ? 'text-primary-700 dark:text-primary-400' : 'text-gray-600 dark:text-[#8E8E93]'}`}>
                          {method.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Transaction details for digital payments */}
              {['UPI', 'Bank Transfer', 'Cheque', 'Card', 'Online'].includes(form.paymentMethod) && (
                <div className="bg-gray-50 dark:bg-[#2C2C2E] rounded-xl p-3 border border-gray-100 dark:border-[#38383A] space-y-3">
                  <span className="text-xs font-semibold text-gray-500 dark:text-[#636366] uppercase">Transaction Details</span>
                  {form.paymentMethod === 'UPI' && (
                    <input type="text" className="input text-sm" placeholder="UPI Transaction ID / Reference"
                      value={form.transactionDetails.upiId || ''}
                      onChange={e => setForm(prev => ({ ...prev, transactionDetails: { ...prev.transactionDetails, upiId: e.target.value } }))} />
                  )}
                  {form.paymentMethod === 'Bank Transfer' && (
                    <input type="text" className="input text-sm" placeholder="Bank Transfer Reference Number"
                      value={form.transactionDetails.referenceNumber || ''}
                      onChange={e => setForm(prev => ({ ...prev, transactionDetails: { ...prev.transactionDetails, referenceNumber: e.target.value } }))} />
                  )}
                  {form.paymentMethod === 'Cheque' && (
                    <div className="grid grid-cols-2 gap-3">
                      <input type="text" className="input text-sm" placeholder="Cheque Number"
                        value={form.transactionDetails.chequeNumber || ''}
                        onChange={e => setForm(prev => ({ ...prev, transactionDetails: { ...prev.transactionDetails, chequeNumber: e.target.value } }))} />
                      <input type="text" className="input text-sm" placeholder="Bank Name"
                        value={form.transactionDetails.bankName || ''}
                        onChange={e => setForm(prev => ({ ...prev, transactionDetails: { ...prev.transactionDetails, bankName: e.target.value } }))} />
                    </div>
                  )}
                  {form.paymentMethod === 'Card' && (
                    <input type="text" className="input text-sm" placeholder="Card Transaction Reference"
                      value={form.transactionDetails.cardRef || ''}
                      onChange={e => setForm(prev => ({ ...prev, transactionDetails: { ...prev.transactionDetails, cardRef: e.target.value } }))} />
                  )}
                  {form.paymentMethod === 'Online' && (
                    <div className="space-y-2">
                      <select
                        className="input text-sm"
                        value={form.transactionDetails.onlineMode || ''}
                        onChange={e => setForm(prev => ({ ...prev, transactionDetails: { ...prev.transactionDetails, onlineMode: e.target.value } }))}
                      >
                        <option value="">Select online mode…</option>
                        <option value="UPI">UPI</option>
                        <option value="NEFT">NEFT</option>
                        <option value="IMPS">IMPS</option>
                        <option value="RTGS">RTGS</option>
                        <option value="Net Banking">Net Banking</option>
                        <option value="Other">Other</option>
                      </select>
                      <input type="text" className="input text-sm" placeholder="Online Payment Reference / Order ID"
                        value={form.transactionDetails.onlineRef || ''}
                        onChange={e => setForm(prev => ({ ...prev, transactionDetails: { ...prev.transactionDetails, onlineRef: e.target.value } }))} />
                    </div>
                  )}
                </div>
              )}

              {/* Payment date */}
              <div>
                <label className="label mb-1.5 block">Payment Date *</label>
                <input
                  type="date"
                  className="input"
                  value={form.paymentDate}
                  onChange={(e) => setForm(prev => ({ ...prev, paymentDate: e.target.value }))}
                  max={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>

              {/* Depositor + remarks */}
              <div>
                <label className="label mb-1.5 block">Depositor Name</label>
                <input type="text" className="input" value={form.depositorName}
                  onChange={(e) => setForm(prev => ({ ...prev, depositorName: e.target.value }))}
                  placeholder="Name of person depositing the fees" />
              </div>
              <div>
                <label className="label mb-1.5 block">Remarks</label>
                <input type="text" className="input" value={form.remarks}
                  onChange={(e) => setForm(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Optional notes about this payment" />
              </div>

              {/* Total summary */}
              <div className="bg-primary-50 dark:bg-primary-900/15 border border-primary-200 dark:border-primary-800/30 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-primary-800 dark:text-primary-300">
                    Total ({bulkSelectedCount} invoice{bulkSelectedCount === 1 ? '' : 's'})
                  </span>
                  <span className="text-lg font-bold text-primary-700 dark:text-primary-400">
                    {formatCurrency(bulkTotal)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-5 border-t border-gray-100 dark:border-[#38383A]">
                <button type="button" onClick={onClose} className="btn btn-outline w-full sm:w-auto">Cancel</button>
                <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={isSaving || bulkSelectedCount === 0}>
                  {isSaving ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    `Collect ${formatCurrency(bulkTotal)}`
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Student info */}
              <div className="flex items-center gap-3 p-3.5 bg-gray-50 dark:bg-[#2C2C2E] rounded-xl border border-gray-100 dark:border-[#38383A]">
                <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary-700 dark:text-primary-400">
                    {(student.fullName || student.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{student.fullName || student.name}</p>
                  <p className="text-xs text-gray-500 dark:text-[#636366]">
                    ID: {student.studentId || student.admissionNumber} &middot; Class: {student.classId?.name || student.class || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Mode toggle */}
              {invoices.length > 1 && (
                <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-[#38383A]">
                  <button type="button" className="flex-1 py-2 text-xs font-medium bg-primary-600 text-white dark:bg-primary-500">
                    Single Invoice
                  </button>
                  <button type="button" onClick={() => setCollectMode('multi')} className="flex-1 py-2 text-xs font-medium bg-white dark:bg-[#1C1C1E] text-gray-500 dark:text-[#8E8E93]">
                    Multiple Invoices
                  </button>
                </div>
              )}

              {/* Quarter / Period filter */}
              {periodOptions.length > 0 && (
                <div>
                  <label className="label mb-1.5 block">Select Quarter / Period</label>
                  <div className="flex flex-wrap gap-2">
                    {periodOptions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setSelectedQuarter('all')}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border-2 transition-all ${
                          selectedQuarter === 'all'
                            ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400 dark:border-primary-400'
                            : 'border-gray-200 dark:border-[#38383A] text-gray-600 dark:text-[#8E8E93] hover:border-gray-300 dark:hover:border-[#636366]'
                        }`}
                      >
                        All ({invoices.length})
                      </button>
                    )}
                    {periodOptions.map((period) => {
                      const count = invoices.filter(inv => (inv.periodLabel || inv.billingPeriod?.displayText || '') === period.value).length
                      return (
                        <button
                          key={period.value}
                          type="button"
                          onClick={() => setSelectedQuarter(period.value)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border-2 transition-all ${
                            selectedQuarter === period.value
                              ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400 dark:border-primary-400'
                              : 'border-gray-200 dark:border-[#38383A] text-gray-600 dark:text-[#8E8E93] hover:border-gray-300 dark:hover:border-[#636366]'
                          }`}
                        >
                          {period.label} ({count})
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Invoice selector */}
              <div>
                <label className="label mb-1.5 block">Select Invoice *</label>
                {filteredInvoices.length === 0 ? (
                  <div className="text-center py-4 bg-gray-50 dark:bg-[#2C2C2E] rounded-xl border border-gray-100 dark:border-[#38383A]">
                    <p className="text-sm text-gray-500 dark:text-[#8E8E93]">No pending invoices for this period</p>
                  </div>
                ) : (
                  <select
                    className="input"
                    value={selectedInvoice?._id || ''}
                    onChange={(e) => {
                      const inv = filteredInvoices.find(i => i._id === e.target.value)
                      setSelectedInvoice(inv)
                      setForm(f => ({ ...f, amount: inv?.balanceAmount || '' }))
                    }}
                    required
                  >
                    {filteredInvoices.map((inv) => {
                      const period = inv.periodLabel || inv.billingPeriod?.displayText || ''
                      return (
                        <option key={inv._id} value={inv._id}>
                          {inv.invoiceNumber}{period ? ` — ${period}` : ''} — {formatCurrency(inv.balanceAmount)} ({inv.status})
                        </option>
                      )
                    })}
                  </select>
                )}
              </div>

              {/* Selected invoice summary with progress */}
              {selectedInvoice && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-[#2C2C2E] border border-gray-100 dark:border-[#38383A]">
                      <p className="text-[10px] font-semibold text-gray-500 dark:text-[#636366] uppercase">Total</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">{formatCurrency(selectedInvoice.totalAmount)}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
                      <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase">Paid</p>
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">{formatCurrency(selectedInvoice.paidAmount || 0)}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30">
                      <p className="text-[10px] font-semibold text-red-600 dark:text-red-400 uppercase">Balance</p>
                      <p className="text-sm font-bold text-red-700 dark:text-red-400 mt-0.5">{formatCurrency(selectedInvoice.balanceAmount)}</p>
                    </div>
                  </div>

                  {/* Payment progress bar */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-500 dark:text-[#636366]">Payment Progress</span>
                      <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">{paymentProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 dark:bg-[#38383A] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary-500 to-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${paymentProgress}%` }}
                      />
                    </div>
                  </div>

                  {/* Fee heads breakdown */}
                  {selectedInvoice.feeItems?.length > 0 && (
                    <div className="bg-gray-50 dark:bg-[#2C2C2E] rounded-xl border border-gray-100 dark:border-[#38383A] overflow-hidden">
                      <div className="px-3 py-2 border-b border-gray-100 dark:border-[#38383A]">
                        <span className="text-[10px] font-semibold text-gray-500 dark:text-[#636366] uppercase tracking-wide">Fee Breakdown</span>
                      </div>
                      <div className="divide-y divide-gray-100 dark:divide-[#38383A]">
                        {selectedInvoice.feeItems.map((item, i) => (
                          <div key={i} className="px-3 py-2 flex justify-between text-xs">
                            <span className="text-gray-600 dark:text-[#8E8E93]">{item.name || item.feeHeadName || `Item ${i + 1}`}</span>
                            <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(item.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Due date warning */}
                  {selectedInvoice.dueDate && new Date(selectedInvoice.dueDate) < new Date() && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/15 border border-red-200 dark:border-red-800/30 rounded-xl">
                      <AlertCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                      <span className="text-xs text-red-700 dark:text-red-400">
                        Overdue since {new Date(selectedInvoice.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Inline discount toggle (also used for editing existing discount, or bulk apply across period) */}
              {selectedInvoice && (!selectedInvoice.discountAmount || isEditingDiscount || filteredInvoices.length > 1) && (
                <div className="border border-gray-100 dark:border-[#38383A] rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowDiscount(!showDiscount)}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                      {isEditingDiscount ? 'Edit Discount / Waiver' : 'Apply Discount / Waiver'}
                    </span>
                    {showDiscount ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>

                  {showDiscount && (
                    <div className="px-4 pb-4 pt-1 space-y-3 border-t border-gray-100 dark:border-[#38383A] bg-blue-50/30 dark:bg-blue-950/10">
                      {filteredInvoices.length > 1 && !isEditingDiscount && (
                        <label className="flex items-start gap-2 px-3 py-2 bg-white dark:bg-[#1C1C1E] rounded-xl border border-blue-200 dark:border-blue-800/40 cursor-pointer">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={applyDiscountToAll}
                            onChange={(e) => setApplyDiscountToAll(e.target.checked)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-900 dark:text-white">
                              Apply to all {filteredInvoices.length} invoices in this period
                            </p>
                            <p className="text-[11px] text-gray-500 dark:text-[#8E8E93]">
                              {discountMode === 'percentage'
                                ? 'Same percentage applied per-invoice'
                                : 'Same fixed amount applied per-invoice (capped to invoice total)'}
                              . Existing discounts on those invoices will be overwritten.
                            </p>
                          </div>
                        </label>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label mb-1 block text-xs">Type *</label>
                          <select
                            className="input text-xs"
                            value={discountForm.type}
                            onChange={e => setDiscountForm(f => ({ ...f, type: e.target.value }))}
                          >
                            <option value="">Select...</option>
                            {DISCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="label mb-1 block text-xs">Mode</label>
                          <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-[#38383A]">
                            <button
                              type="button"
                              onClick={() => setDiscountMode('fixed')}
                              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                                discountMode === 'fixed'
                                  ? 'bg-primary-600 text-white dark:bg-primary-500'
                                  : 'bg-white dark:bg-[#1C1C1E] text-gray-500 dark:text-[#8E8E93]'
                              }`}
                            >
                              Fixed ₹
                            </button>
                            <button
                              type="button"
                              onClick={() => setDiscountMode('percentage')}
                              className={`flex-1 py-2 text-xs font-medium transition-colors ${
                                discountMode === 'percentage'
                                  ? 'bg-primary-600 text-white dark:bg-primary-500'
                                  : 'bg-white dark:bg-[#1C1C1E] text-gray-500 dark:text-[#8E8E93]'
                              }`}
                            >
                              Percent %
                            </button>
                          </div>
                        </div>
                      </div>

                      {discountMode === 'fixed' ? (
                        <div>
                          <label className="label mb-1 block text-xs">Amount *</label>
                          <input
                            type="number" min="1" step="1" max={selectedInvoice?.totalAmount}
                            className="input text-xs"
                            placeholder="e.g. 500"
                            value={discountForm.amount}
                            onWheel={preventScrollChange}
                            onChange={e => setDiscountForm(f => ({ ...f, amount: e.target.value }))}
                          />
                        </div>
                      ) : (
                        <div>
                          <label className="label mb-1 block text-xs">Percentage *</label>
                          <input
                            type="number" min="1" max="100" step="1"
                            className="input text-xs"
                            placeholder="e.g. 10"
                            value={discountForm.percentage}
                            onWheel={preventScrollChange}
                            onChange={e => setDiscountForm(f => ({ ...f, percentage: e.target.value }))}
                          />
                          {discountForm.percentage > 0 && (
                            <p className="text-xs text-primary-600 dark:text-primary-400 font-medium mt-1">= {formatCurrency(discountCalcAmount)}</p>
                          )}
                        </div>
                      )}

                      <div>
                        <label className="label mb-1 block text-xs">Reason *</label>
                        <input
                          type="text"
                          className="input text-xs"
                          placeholder="e.g. Scholarship awarded"
                          value={discountForm.reason}
                          onChange={e => setDiscountForm(f => ({ ...f, reason: e.target.value }))}
                        />
                      </div>

                      {/* Discount preview */}
                      {discountCalcAmount > 0 && (
                        <div className="flex items-center justify-between px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800/30">
                          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">New balance after discount</span>
                          <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(effectiveBalance)}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        {isEditingDiscount && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditingDiscount(false)
                              setShowDiscount(false)
                              setDiscountForm({ type: '', amount: '', percentage: '', reason: '' })
                            }}
                            disabled={isApplyingDiscount}
                            className="btn btn-sm btn-outline disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleApplyDiscount}
                          disabled={isApplyingDiscount}
                          className="btn btn-sm flex-1 bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 disabled:opacity-50"
                        >
                          {isApplyingDiscount
                            ? (isEditingDiscount ? 'Updating...' : 'Applying...')
                            : (applyDiscountToAll && filteredInvoices.length > 1
                                ? `Apply to ${filteredInvoices.length} Invoices`
                                : (isEditingDiscount ? 'Update Discount' : 'Apply Discount'))}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Already has discount badge with edit/remove */}
              {selectedInvoice?.discountAmount > 0 && !isEditingDiscount && (
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800/30">
                  <Tag className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                      Discount applied: {formatCurrency(selectedInvoice.discountAmount)}
                    </p>
                    {(selectedInvoice.discountType || selectedInvoice.discountReason) && (
                      <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/70 truncate">
                        {selectedInvoice.discountType}{selectedInvoice.discountReason ? ` — ${selectedInvoice.discountReason}` : ''}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleEditDiscount}
                    className="p-1.5 rounded-lg text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                    title="Edit discount"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveDiscount}
                    disabled={isRemovingDiscount}
                    className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                    title="Remove discount"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Payment amount */}
              <div>
                <label className="label mb-1.5 block">Amount *</label>
                <input
                  type="number"
                  className="input"
                  value={form.amount}
                  onWheel={preventScrollChange}
                  onChange={(e) => setForm(prev => ({ ...prev, amount: e.target.value }))}
                  max={selectedInvoice?.balanceAmount}
                  min="1"
                  step="1"
                  required
                />
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-xs text-gray-400 dark:text-[#636366]">
                    Max: {formatCurrency(selectedInvoice?.balanceAmount || 0)}
                  </p>
                  {selectedInvoice?.balanceAmount && parseFloat(form.amount) < selectedInvoice.balanceAmount && parseFloat(form.amount) > 0 && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Partial payment</span>
                  )}
                </div>

                {/* Quick-fill buttons for partial payments (monthly splits from quarterly/annual invoices) */}
                {selectedInvoice && selectedInvoice.balanceAmount > 0 && (() => {
                  const balance = selectedInvoice.balanceAmount
                  const period = selectedInvoice.periodLabel || selectedInvoice.billingPeriod?.displayText || ''
                  const isQuarterly = /q[1-4]|quarter/i.test(period)
                  const isHalfYearly = /h[1-2]|half/i.test(period)
                  const isAnnual = /annual|year/i.test(period)

                  const splits = []
                  if (isQuarterly && balance > 0) {
                    const monthly = Math.round(balance / 3)
                    if (monthly > 0 && monthly < balance) {
                      splits.push({ label: '1 Month', amount: monthly })
                      splits.push({ label: '2 Months', amount: monthly * 2 })
                    }
                  } else if (isHalfYearly && balance > 0) {
                    const monthly = Math.round(balance / 6)
                    if (monthly > 0 && monthly < balance) {
                      splits.push({ label: '1 Month', amount: monthly })
                      splits.push({ label: '3 Months', amount: monthly * 3 })
                    }
                  } else if (isAnnual && balance > 0) {
                    const quarterly = Math.round(balance / 4)
                    const monthly = Math.round(balance / 12)
                    if (monthly > 0 && monthly < balance) {
                      splits.push({ label: '1 Month', amount: monthly })
                    }
                    if (quarterly > 0 && quarterly < balance) {
                      splits.push({ label: '1 Quarter', amount: quarterly })
                    }
                  }

                  if (splits.length === 0) return null

                  return (
                    <div className="mt-2">
                      <p className="text-[10px] font-semibold text-gray-400 dark:text-[#636366] uppercase tracking-wide mb-1.5">Quick Fill (Partial Payment)</p>
                      <div className="flex flex-wrap gap-1.5">
                        {splits.map((s, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setForm(f => ({ ...f, amount: s.amount }))}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                              parseFloat(form.amount) === s.amount
                                ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400 dark:border-primary-400'
                                : 'border-gray-200 dark:border-[#38383A] text-gray-600 dark:text-[#8E8E93] hover:border-gray-300'
                            }`}
                          >
                            {s.label} — {formatCurrency(s.amount)}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setForm(f => ({ ...f, amount: balance }))}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                            parseFloat(form.amount) === balance
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-400'
                              : 'border-gray-200 dark:border-[#38383A] text-gray-600 dark:text-[#8E8E93] hover:border-gray-300'
                          }`}
                        >
                          Full — {formatCurrency(balance)}
                        </button>
                      </div>
                    </div>
                  )
                })()}

                {/* Remaining balance preview after partial payment */}
                {selectedInvoice?.balanceAmount && parseFloat(form.amount) > 0 && parseFloat(form.amount) < selectedInvoice.balanceAmount && (
                  <div className="mt-2 flex items-center justify-between px-3 py-2 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-200 dark:border-amber-800/30">
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Remaining after this payment</span>
                    <span className="text-sm font-bold text-amber-700 dark:text-amber-300">
                      {formatCurrency(selectedInvoice.balanceAmount - parseFloat(form.amount))}
                    </span>
                  </div>
                )}
              </div>

              {/* Payment method with icons */}
              <div>
                <label className="label mb-1.5 block">Payment Method *</label>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map((method) => {
                    const Icon = method.icon
                    const isSelected = form.paymentMethod === method.value
                    return (
                      <button
                        key={method.value}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, paymentMethod: method.value, transactionDetails: {} }))}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${
                          isSelected
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 dark:border-primary-400'
                            : 'border-gray-200 dark:border-[#38383A] hover:border-gray-300 dark:hover:border-[#636366]'
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${isSelected ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-[#636366]'}`} />
                        <span className={`text-xs font-medium ${isSelected ? 'text-primary-700 dark:text-primary-400' : 'text-gray-600 dark:text-[#8E8E93]'}`}>
                          {method.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Transaction details for digital payments */}
              {['UPI', 'Bank Transfer', 'Cheque', 'Card', 'Online'].includes(form.paymentMethod) && (
                <div className="bg-gray-50 dark:bg-[#2C2C2E] rounded-xl p-3 border border-gray-100 dark:border-[#38383A] space-y-3">
                  <span className="text-xs font-semibold text-gray-500 dark:text-[#636366] uppercase">Transaction Details</span>
                  {form.paymentMethod === 'UPI' && (
                    <input
                      type="text"
                      className="input text-sm"
                      placeholder="UPI Transaction ID / Reference"
                      value={form.transactionDetails.upiId || ''}
                      onChange={e => setForm(prev => ({ ...prev, transactionDetails: { ...prev.transactionDetails, upiId: e.target.value } }))}
                    />
                  )}
                  {form.paymentMethod === 'Bank Transfer' && (
                    <input
                      type="text"
                      className="input text-sm"
                      placeholder="Bank Transfer Reference Number"
                      value={form.transactionDetails.referenceNumber || ''}
                      onChange={e => setForm(prev => ({ ...prev, transactionDetails: { ...prev.transactionDetails, referenceNumber: e.target.value } }))}
                    />
                  )}
                  {form.paymentMethod === 'Cheque' && (
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        className="input text-sm"
                        placeholder="Cheque Number"
                        value={form.transactionDetails.chequeNumber || ''}
                        onChange={e => setForm(prev => ({ ...prev, transactionDetails: { ...prev.transactionDetails, chequeNumber: e.target.value } }))}
                      />
                      <input
                        type="text"
                        className="input text-sm"
                        placeholder="Bank Name"
                        value={form.transactionDetails.bankName || ''}
                        onChange={e => setForm(prev => ({ ...prev, transactionDetails: { ...prev.transactionDetails, bankName: e.target.value } }))}
                      />
                    </div>
                  )}
                  {form.paymentMethod === 'Card' && (
                    <input
                      type="text"
                      className="input text-sm"
                      placeholder="Card Transaction Reference"
                      value={form.transactionDetails.cardRef || ''}
                      onChange={e => setForm(prev => ({ ...prev, transactionDetails: { ...prev.transactionDetails, cardRef: e.target.value } }))}
                    />
                  )}
                  {form.paymentMethod === 'Online' && (
                    <div className="space-y-2">
                      <select
                        className="input text-sm"
                        value={form.transactionDetails.onlineMode || ''}
                        onChange={e => setForm(prev => ({ ...prev, transactionDetails: { ...prev.transactionDetails, onlineMode: e.target.value } }))}
                      >
                        <option value="">Select online mode…</option>
                        <option value="UPI">UPI</option>
                        <option value="NEFT">NEFT</option>
                        <option value="IMPS">IMPS</option>
                        <option value="RTGS">RTGS</option>
                        <option value="Net Banking">Net Banking</option>
                        <option value="Other">Other</option>
                      </select>
                      <input
                        type="text"
                        className="input text-sm"
                        placeholder="Online Payment Reference / Order ID"
                        value={form.transactionDetails.onlineRef || ''}
                        onChange={e => setForm(prev => ({ ...prev, transactionDetails: { ...prev.transactionDetails, onlineRef: e.target.value } }))}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Payment date */}
              <div>
                <label className="label mb-1.5 block">Payment Date *</label>
                <input
                  type="date"
                  className="input"
                  value={form.paymentDate}
                  onChange={(e) => setForm(prev => ({ ...prev, paymentDate: e.target.value }))}
                  max={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>

              {/* Depositor name */}
              <div>
                <label className="label mb-1.5 block">Depositor Name</label>
                <input
                  type="text"
                  className="input"
                  value={form.depositorName}
                  onChange={(e) => setForm(prev => ({ ...prev, depositorName: e.target.value }))}
                  placeholder="Name of person depositing the fees (prints on receipt)"
                />
              </div>

              {/* Remarks */}
              <div>
                <label className="label mb-1.5 block">Remarks</label>
                <input
                  type="text"
                  className="input"
                  value={form.remarks}
                  onChange={(e) => setForm(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Optional notes about this payment"
                />
              </div>

              {/* Payment summary */}
              <div className="bg-primary-50 dark:bg-primary-900/15 border border-primary-200 dark:border-primary-800/30 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-primary-800 dark:text-primary-300">Amount to Collect</span>
                  <span className="text-lg font-bold text-primary-700 dark:text-primary-400">
                    {formatCurrency(parseFloat(form.amount) || 0)}
                  </span>
                </div>
                {form.paymentMethod && (
                  <p className="text-xs text-primary-600 dark:text-primary-400/80 mt-1">
                    via {form.paymentMethod} &middot; {new Date(form.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-5 border-t border-gray-100 dark:border-[#38383A]">
                <button type="button" onClick={onClose} className="btn btn-outline w-full sm:w-auto">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={isSaving}>
                  {isSaving ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    `Collect ${formatCurrency(parseFloat(form.amount) || 0)}`
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="p-4 sm:p-6">
          {payments.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-[#2C2C2E] flex items-center justify-center mx-auto mb-4">
                <History className="h-7 w-7 text-gray-400 dark:text-[#636366]" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">No Payment History</h3>
              <p className="text-sm text-gray-500 dark:text-[#8E8E93]">No payments found for this student.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Total summary */}
              <div className="bg-gray-50 dark:bg-[#2C2C2E] rounded-xl p-3 border border-gray-100 dark:border-[#38383A] flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 dark:text-[#636366] uppercase">Total Paid</span>
                <span className="text-base font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(payments.reduce((sum, p) => sum + (p.amount || 0), 0))}
                </span>
              </div>

              {payments.map((payment) => (
                <div key={payment._id} className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-[#2C2C2E] rounded-xl border border-gray-100 dark:border-[#38383A]">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(payment.amount)}</span>
                      <StatusBadge status="Paid" />
                    </div>
                    <div className="text-xs text-gray-500 dark:text-[#8E8E93]">
                      {new Date(payment.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} &bull; {payment.paymentMethod}
                    </div>
                    {payment.receiptNumber && (
                      <p className="text-[11px] text-gray-400 dark:text-[#636366] mt-0.5 font-mono">Receipt: {payment.receiptNumber}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => onPrintReceipt(payment._id)} className="btn-icon !p-2" title="View Receipt">
                      <Printer className="h-4 w-4" />
                    </button>
                    {onDownloadReceipt && (
                      <button onClick={() => onDownloadReceipt(payment._id)} className="btn-icon !p-2" title="Download PDF">
                        <Download className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-6 flex justify-end pt-4 border-t border-gray-100 dark:border-[#38383A]">
            <button type="button" onClick={onClose} className="btn btn-outline">Close</button>
          </div>
        </div>
      )}
    </ModalWrapper>
  )
}

export default PaymentModal
