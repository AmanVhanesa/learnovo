import React, { useState, useMemo } from 'react'
import { FileText, AlertCircle, CheckCircle, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'
import { allocationsService } from '../../services/feesService'
import { formatCurrency } from '../../utils/formatCurrency'
import ModalWrapper from '../ModalWrapper'
import StudentSearch from './StudentSearch'

const PAYMENT_PLANS = [
  { value: 'quarterly', label: 'Quarterly (4 installments)', description: 'Recommended — 4 invoices per year' },
  { value: 'monthly', label: 'Monthly (12 installments)', description: '12 invoices per year' },
  { value: 'half-yearly', label: 'Semi-Annual (2 installments)', description: '2 invoices per year' },
  { value: 'annual', label: 'Annual (1 payment)', description: 'Single invoice for the entire year' },
]

const IndividualInvoiceModal = ({ feeStructures, activeSession, onClose, onSuccess }) => {
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [paymentPlan, setPaymentPlan] = useState('quarterly')
  const [isSaving, setIsSaving] = useState(false)
  const [result, setResult] = useState(null)

  const activeFeeStructures = useMemo(
    () => feeStructures.filter(fs => fs.isActive),
    [feeStructures]
  )

  // Auto-detect fee structure matching student's class
  const studentClassId = typeof selectedStudent?.classId === 'object' ? selectedStudent.classId?._id : selectedStudent?.classId
  const matchingStructure = useMemo(() => {
    if (!studentClassId) return null
    const sId = String(studentClassId)
    const matched = activeFeeStructures.filter(fs => {
      const fsClassId = typeof fs.classId === 'object' ? fs.classId._id : fs.classId
      return String(fsClassId) === sId
    })
    return matched.length >= 1 ? matched[0] : null
  }, [activeFeeStructures, studentClassId])

  // Filter fee heads based on student status
  const applicableFeeHeads = useMemo(() => {
    if (!matchingStructure?.feeHeads) return []
    return matchingStructure.feeHeads.map(head => {
      const annualAmount = head.annualAmount || head.amount || 0
      const type = head.type || (head.frequency === 'one-time' ? 'one_time' : 'recurring')
      const isExcluded = head.isAdmissionFee && (selectedStudent?.isImported || selectedStudent?.admissionFeePaid)

      return {
        ...head,
        annualAmount,
        type,
        isExcluded,
        exclusionReason: isExcluded
          ? (selectedStudent?.isImported ? 'Imported student — exempt' : 'Already paid')
          : null
      }
    })
  }, [matchingStructure, selectedStudent])

  const recurringHeads = applicableFeeHeads.filter(h => h.type === 'recurring' && !h.isExcluded)
  const oneTimeHeads = applicableFeeHeads.filter(h => h.type === 'one_time' && !h.isExcluded)
  const excludedHeads = applicableFeeHeads.filter(h => h.isExcluded)

  const recurringTotal = recurringHeads.reduce((sum, h) => sum + h.annualAmount, 0)
  const oneTimeTotal = oneTimeHeads.reduce((sum, h) => sum + h.annualAmount, 0)
  const totalAnnual = recurringTotal + oneTimeTotal

  // Calculate invoice preview based on payment plan
  const invoicePreview = useMemo(() => {
    const planDivisor = { monthly: 12, quarterly: 4, 'half-yearly': 2, annual: 1 }[paymentPlan] || 4
    const perPeriod = Math.round(recurringTotal / planDivisor)
    const periods = []

    const planLabels = {
      monthly: Array.from({ length: 12 }, (_, i) => `Month ${i + 1}`),
      quarterly: ['Q1 (Apr-Jun)', 'Q2 (Jul-Sep)', 'Q3 (Oct-Dec)', 'Q4 (Jan-Mar)'],
      'half-yearly': ['H1 (Apr-Sep)', 'H2 (Oct-Mar)'],
      annual: ['Full Year']
    }

    const labels = planLabels[paymentPlan] || planLabels.quarterly

    for (let i = 0; i < labels.length; i++) {
      let amount = perPeriod
      if (i === 0) amount += oneTimeTotal
      periods.push({ label: labels[i], amount })
    }

    return periods
  }, [recurringTotal, oneTimeTotal, paymentPlan])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!selectedStudent) {
      toast.error('Please select a student')
      return
    }
    if (!matchingStructure) {
      toast.error('No fee structure found for this student\'s class')
      return
    }

    try {
      setIsSaving(true)
      const response = await allocationsService.generateSingle({
        studentId: selectedStudent._id,
        academicSessionId: activeSession._id,
        paymentPlan,
      })
      setResult(response.data)
      toast.success(response.message || 'Invoices generated successfully')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to generate invoices')
    } finally {
      setIsSaving(false)
    }
  }

  // Success state
  if (result) {
    return (
      <ModalWrapper title="Invoices Generated" onClose={() => { onSuccess(); onClose() }}>
        <div className="p-6 text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {result.summary?.invoiceCount || result.invoices?.length || 0} Invoices Generated
          </h3>
          <p className="text-sm text-gray-600 dark:text-[#8E8E93]">
            Annual total: {formatCurrency(result.summary?.total || 0)} &middot; Plan: {paymentPlan}
          </p>
          <button onClick={() => { onSuccess(); onClose() }} className="btn btn-primary mt-4">
            Done
          </button>
        </div>
      </ModalWrapper>
    )
  }

  return (
    <ModalWrapper title="Generate Invoices for Student" onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-4 sm:p-6">
        <div className="space-y-5">
          {/* Student Search */}
          <div>
            <label className="label mb-1.5 block">Select Student *</label>
            <StudentSearch onSelectStudent={(student) => {
              setSelectedStudent(student)
              setResult(null)
            }} />
            {selectedStudent && (
              <div className="mt-3 flex items-center gap-3 p-3 bg-primary-50 dark:bg-primary-900/15 border border-primary-200 dark:border-primary-800/30 rounded-xl">
                <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary-700 dark:text-primary-400">
                    {(selectedStudent.fullName || selectedStudent.name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {selectedStudent.fullName || selectedStudent.name}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-[#8E8E93]">
                    {selectedStudent.admissionNumber || selectedStudent.studentId || 'N/A'} &middot; {selectedStudent.classId?.name || selectedStudent.class || 'N/A'}
                    {selectedStudent.isImported && <span className="ml-1 text-amber-600">(Imported)</span>}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedStudent(null); setResult(null) }}
                  className="text-xs text-gray-500 dark:text-[#636366] hover:text-red-500 dark:hover:text-red-400"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          {/* Fee Structure (auto-detected, read-only) */}
          {selectedStudent && (
            <div>
              <label className="label mb-1.5 block">Fee Structure</label>
              {!matchingStructure ? (
                <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/30 rounded-xl">
                  <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    No active fee structure found for this student's class. Please create one first.
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/15 border border-green-200 dark:border-green-800/30 rounded-xl">
                  <FileText className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-800 dark:text-green-300">
                      {(() => {
                        const cn = typeof matchingStructure.classId === 'object' ? matchingStructure.classId?.name : ''
                        return `${cn ? `${cn} — ` : ''}${formatCurrency(totalAnnual)}/year (${matchingStructure.feeHeads?.length} fee heads)`
                      })()}
                    </p>
                    <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">Auto-detected from student's class</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fee Breakdown */}
          {matchingStructure && selectedStudent && (
            <div className="bg-gray-50 dark:bg-[#2C2C2E] rounded-xl border border-gray-100 dark:border-[#38383A] overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-[#38383A] flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 dark:text-[#636366] uppercase tracking-wide flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Annual Fee Breakdown
                </span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(totalAnnual)}</span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-[#38383A]">
                {recurringHeads.map((head, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{head.name}</span>
                      <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded">
                        Recurring
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(head.annualAmount)}/yr</span>
                  </div>
                ))}
                {oneTimeHeads.map((head, i) => (
                  <div key={`ot-${i}`} className="px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{head.name}</span>
                      <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded">
                        One-Time
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(head.annualAmount)}</span>
                  </div>
                ))}
                {excludedHeads.map((head, i) => (
                  <div key={`ex-${i}`} className="px-4 py-2 bg-amber-50/50 dark:bg-amber-900/10">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400 dark:text-[#636366] line-through">{head.name}</span>
                      <span className="text-xs text-amber-600 dark:text-amber-400">{head.exclusionReason}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment Plan Selection */}
          {matchingStructure && selectedStudent && (
            <div>
              <label className="label mb-2 block">Payment Plan *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PAYMENT_PLANS.map((plan) => (
                  <label
                    key={plan.value}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      paymentPlan === plan.value
                        ? 'border-primary-400 dark:border-primary-600 bg-primary-50 dark:bg-primary-900/15 ring-1 ring-primary-400 dark:ring-primary-600'
                        : 'border-gray-200 dark:border-[#38383A] hover:border-gray-300 dark:hover:border-[#48484A]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentPlan"
                      value={plan.value}
                      checked={paymentPlan === plan.value}
                      onChange={() => setPaymentPlan(plan.value)}
                      className="mt-0.5 text-primary-600 focus:ring-primary-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{plan.label}</p>
                      <p className="text-[11px] text-gray-500 dark:text-[#636366]">{plan.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Invoice Preview */}
          {matchingStructure && selectedStudent && invoicePreview.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/15 border border-blue-200 dark:border-blue-800/30 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-semibold text-blue-900 dark:text-blue-300">Invoice Preview</span>
              </div>
              <div className="space-y-1.5">
                {invoicePreview.map((period, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-blue-800 dark:text-blue-300">{period.label}</span>
                    <span className="font-semibold text-blue-900 dark:text-blue-200">
                      {formatCurrency(period.amount)}
                      {i === 0 && oneTimeTotal > 0 && (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 ml-1">(incl. one-time)</span>
                      )}
                    </span>
                  </div>
                ))}
                <div className="border-t border-blue-200 dark:border-blue-800/30 pt-1.5 mt-1.5 flex items-center justify-between text-sm font-bold">
                  <span className="text-blue-900 dark:text-blue-200">Year Total</span>
                  <span className="text-blue-900 dark:text-blue-200">{formatCurrency(totalAnnual)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-6 border-t border-gray-200 dark:border-[#38383A] mt-6">
          <button type="button" onClick={onClose} className="btn btn-outline w-full sm:w-auto">
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary w-full sm:w-auto"
            disabled={isSaving || !selectedStudent || !matchingStructure}
          >
            {isSaving ? 'Generating...' : `Generate ${invoicePreview.length} Invoice${invoicePreview.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </form>
    </ModalWrapper>
  )
}

export default IndividualInvoiceModal
