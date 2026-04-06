import React, { useState, useMemo } from 'react'
import { Users, AlertCircle, CheckCircle2, ChevronRight, Layers, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'
import { allocationsService } from '../../services/feesService'
import { formatCurrency } from '../../utils/formatCurrency'

const PAYMENT_PLANS = [
  { value: 'quarterly', label: 'Quarterly (4 installments)', description: 'Recommended — 4 invoices per year' },
  { value: 'monthly', label: 'Monthly (12 installments)', description: '12 invoices per year' },
  { value: 'half-yearly', label: 'Semi-Annual (2 installments)', description: '2 invoices per year' },
  { value: 'annual', label: 'Annual (1 payment)', description: 'Single invoice for the entire year' },
]

const BulkInvoiceForm = ({ classes, feeStructures, activeSession, onSuccess }) => {
  const [form, setForm] = useState({
    classId: '',
    sectionId: '',
    feeStructureId: '',
    paymentPlan: 'quarterly',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [result, setResult] = useState(null)

  const selectedClass = classes.find(c => String(c._id) === String(form.classId))
  const sections = selectedClass?.sections || []

  const filteredStructures = useMemo(
    () => feeStructures.filter(fs => {
      if (!fs.isActive) return false
      const fsClassId = String(typeof fs.classId === 'object' ? fs.classId?._id : fs.classId)
      if (fsClassId !== String(form.classId)) return false
      if (form.sectionId) {
        const fsSectionId = typeof fs.sectionId === 'object' ? fs.sectionId?._id : fs.sectionId
        return !fsSectionId || String(fsSectionId) === String(form.sectionId)
      }
      return true
    }),
    [feeStructures, form.classId, form.sectionId]
  )

  const selectedFeeStructure = feeStructures.find(fs => String(fs._id) === String(form.feeStructureId))
  const feeTotal = selectedFeeStructure?.totalAmount || selectedFeeStructure?.feeHeads?.reduce((sum, h) => sum + (h.amount || h.annualAmount || 0), 0) || 0

  // Calculate invoice preview based on payment plan
  const invoicePreview = useMemo(() => {
    if (!selectedFeeStructure || !form.paymentPlan) return []

    const recurringHeads = selectedFeeStructure.feeHeads?.filter(h => h.type === 'recurring') || []
    const oneTimeHeads = selectedFeeStructure.feeHeads?.filter(h => h.type === 'one_time') || []

    const recurringTotal = recurringHeads.reduce((sum, h) => sum + (h.annualAmount || h.amount || 0), 0)
    const oneTimeTotal = oneTimeHeads.reduce((sum, h) => sum + (h.annualAmount || h.amount || 0), 0)

    const planDivisor = { monthly: 12, quarterly: 4, 'half-yearly': 2, annual: 1 }[form.paymentPlan] || 4
    const perPeriod = Math.round(recurringTotal / planDivisor)

    const planLabels = {
      monthly: Array.from({ length: 12 }, (_, i) => `Month ${i + 1}`),
      quarterly: ['Q1 (Apr-Jun)', 'Q2 (Jul-Sep)', 'Q3 (Oct-Dec)', 'Q4 (Jan-Mar)'],
      'half-yearly': ['H1 (Apr-Sep)', 'H2 (Oct-Mar)'],
      annual: ['Full Year']
    }

    const labels = planLabels[form.paymentPlan] || planLabels.quarterly
    return labels.map((label, i) => ({
      label,
      amount: i === 0 ? perPeriod + oneTimeTotal : perPeriod
    }))
  }, [selectedFeeStructure, form.paymentPlan])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setResult(null)

    if (!form.classId || !form.paymentPlan) {
      toast.error('Please fill all required fields')
      return
    }

    try {
      setIsSaving(true)

      const res = await allocationsService.generateAll({
        classId: form.classId,
        sectionId: form.sectionId || undefined,
        academicSessionId: activeSession._id,
        paymentPlan: form.paymentPlan,
      })

      const data = res.data || res
      setResult({
        success: true,
        generated: data.generated || 0,
        totalInvoices: data.totalInvoices || 0,
        skipped: data.skipped || 0,
        message: data.message || res.message || 'Invoices generated successfully',
      })
      onSuccess()
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to generate bulk invoices'
      setResult({ success: false, message: msg })
      toast.error(msg)
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    setForm({
      classId: '',
      sectionId: '',
      feeStructureId: '',
      paymentPlan: 'quarterly',
    })
    setResult(null)
  }

  // Stepper logic
  const currentStep = !form.classId ? 0 : !form.paymentPlan ? 1 : 2
  const steps = ['Select Class', 'Payment Plan', 'Generate']

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Progress Steps */}
      <div className="flex items-center gap-1">
        {steps.map((step, i) => (
          <React.Fragment key={step}>
            {i > 0 && <ChevronRight className="h-3 w-3 text-gray-300 dark:text-[#48484A] flex-shrink-0" />}
            <div className="flex items-center gap-1.5">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                i < currentStep
                  ? 'bg-primary-500 text-white'
                  : i === currentStep
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 ring-2 ring-primary-500/30'
                    : 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-400 dark:text-[#636366]'
              }`}>
                {i < currentStep ? '✓' : i + 1}
              </div>
              <span className={`text-[11px] font-medium hidden sm:inline ${
                i <= currentStep ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-[#636366]'
              }`}>{step}</span>
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* Class & Section Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label mb-1.5 block">Class *</label>
          <select
            className="input"
            value={form.classId}
            onChange={(e) => {
              setForm(prev => ({ ...prev, classId: e.target.value, sectionId: '', feeStructureId: '' }))
              setResult(null)
            }}
            required
          >
            <option value="">Select Class</option>
            {classes.map((cls) => (
              <option key={cls._id} value={cls._id}>{cls.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label mb-1.5 block">Section</label>
          <select
            className="input"
            value={form.sectionId}
            onChange={(e) => {
              setForm(prev => ({ ...prev, sectionId: e.target.value, feeStructureId: '' }))
              setResult(null)
            }}
            disabled={!form.classId || sections.length === 0}
          >
            <option value="">All Sections</option>
            {sections.map((sec) => (
              <option key={sec._id || sec.name} value={sec._id || sec.name}>{sec.name}</option>
            ))}
          </select>
          {form.classId && sections.length === 0 && (
            <p className="text-[11px] text-gray-400 dark:text-[#636366] mt-1">No sections in this class</p>
          )}
        </div>
      </div>

      {/* Payment Plan Selection */}
      {form.classId && (
        <div>
          <label className="label mb-2 block">Payment Plan *</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PAYMENT_PLANS.map((plan) => (
              <label
                key={plan.value}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  form.paymentPlan === plan.value
                    ? 'border-primary-400 dark:border-primary-600 bg-primary-50 dark:bg-primary-900/15 ring-1 ring-primary-400 dark:ring-primary-600'
                    : 'border-gray-200 dark:border-[#38383A] hover:border-gray-300 dark:hover:border-[#48484A]'
                }`}
              >
                <input
                  type="radio"
                  name="bulkPaymentPlan"
                  value={plan.value}
                  checked={form.paymentPlan === plan.value}
                  onChange={() => { setForm(prev => ({ ...prev, paymentPlan: plan.value })); setResult(null) }}
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

      {/* Fee Structure Preview (optional — if they want to see what will be billed) */}
      {form.classId && filteredStructures.length > 0 && (
        <div>
          <label className="label mb-1.5 block">Fee Structure (Preview)</label>
          <select
            className="input"
            value={form.feeStructureId}
            onChange={(e) => { setForm(prev => ({ ...prev, feeStructureId: e.target.value })); setResult(null) }}
          >
            <option value="">Select to preview breakdown</option>
            {filteredStructures.map((structure) => {
              const total = structure.totalAmount || structure.feeHeads?.reduce((sum, h) => sum + (h.amount || h.annualAmount || 0), 0) || 0
              const secName = typeof structure.sectionId === 'object' ? structure.sectionId?.name : null
              return (
                <option key={structure._id} value={structure._id}>
                  {formatCurrency(total)} — {structure.feeHeads?.length} fee heads{secName ? ` (${secName})` : ' (All Sections)'}
                </option>
              )
            })}
          </select>
        </div>
      )}

      {/* Invoice Preview */}
      {selectedFeeStructure && invoicePreview.length > 0 && (
        <div className="bg-gray-50 dark:bg-[#2C2C2E] rounded-xl border border-gray-100 dark:border-[#38383A] overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-[#38383A] flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 dark:text-[#636366] uppercase tracking-wide flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" /> Fee Heads
            </span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(feeTotal)}/year</span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-[#38383A]">
            {selectedFeeStructure.feeHeads?.map((h, i) => (
              <div key={i} className="px-4 py-2.5 flex items-center justify-between">
                <div>
                  <span className="text-sm text-gray-600 dark:text-[#8E8E93]">{h.name}</span>
                  <span className="text-[10px] text-gray-400 dark:text-[#636366] ml-2">{h.type === 'one_time' ? '(One-time)' : '(Recurring)'}</span>
                </div>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(h.annualAmount || h.amount)}</span>
              </div>
            ))}
          </div>

          {/* Per-period breakdown */}
          <div className="px-4 py-3 border-t border-gray-200 dark:border-[#38383A] bg-blue-50 dark:bg-blue-900/10">
            <div className="flex items-center gap-1.5 mb-2">
              <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-semibold text-blue-900 dark:text-blue-300">
                Invoice Breakdown ({PAYMENT_PLANS.find(p => p.value === form.paymentPlan)?.label})
              </span>
            </div>
            <div className="space-y-1">
              {invoicePreview.map((period, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-blue-700 dark:text-blue-400">{period.label}</span>
                  <span className="font-semibold text-blue-900 dark:text-blue-200">{formatCurrency(period.amount)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="px-4 py-2.5 border-t border-gray-200 dark:border-[#38383A] bg-gray-100/50 dark:bg-[#1C1C1E]">
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-gray-400 dark:text-[#636366]" />
              <span className="text-xs text-gray-500 dark:text-[#636366]">
                {selectedClass?.name}{form.sectionId ? ` - ${sections.find(s => (s._id || s.name) === form.sectionId)?.name}` : ' (All Sections)'} &middot; All active students will receive invoices
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Result feedback */}
      {result && (
        <div className={`flex items-start gap-2.5 p-3.5 rounded-xl border ${
          result.success
            ? 'bg-green-50 dark:bg-green-900/15 border-green-200 dark:border-green-800/30'
            : 'bg-red-50 dark:bg-red-900/15 border-red-200 dark:border-red-800/30'
        }`}>
          {result.success ? (
            <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <p className={`text-sm font-medium ${result.success ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
              {result.message}
            </p>
            {result.success && (result.generated > 0 || result.skipped > 0) && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                {result.generated} students processed{result.totalInvoices ? `, ${result.totalInvoices} invoices created` : ''}{result.skipped > 0 ? `, ${result.skipped} skipped (already exist)` : ''}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      {result?.success ? (
        <button
          type="button"
          onClick={handleReset}
          className="w-full btn btn-outline"
        >
          Generate More Invoices
        </button>
      ) : (
        <button
          type="submit"
          className="w-full btn btn-primary"
          disabled={isSaving || !form.classId || !form.paymentPlan}
        >
          {isSaving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Generating Invoices...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Users className="h-4 w-4" />
              Generate Bulk Invoices
            </span>
          )}
        </button>
      )}
    </form>
  )
}

export default BulkInvoiceForm
