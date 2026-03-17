import React, { useState, useMemo } from 'react'
import { Users, AlertCircle, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { invoicesService } from '../../services/feesService'
import { buildBillingPeriod, normalizeFrequency } from '../../utils/billingPeriod'
import { formatCurrency } from '../../utils/formatCurrency'
import BillingPeriodSelector from './BillingPeriodSelector'

const BulkInvoiceForm = ({ classes, feeStructures, activeSession, onSuccess }) => {
  const [form, setForm] = useState({
    classId: '',
    feeStructureId: '',
    dueDate: '',
    billingMonth: new Date().getMonth() + 1,
    billingQuarter: Math.ceil((new Date().getMonth() + 1) / 3),
    billingYear: new Date().getFullYear(),
  })
  const [isSaving, setIsSaving] = useState(false)
  const [result, setResult] = useState(null)

  const filteredStructures = useMemo(
    () => feeStructures.filter(fs => fs.isActive && (typeof fs.classId === 'object' ? fs.classId?._id : fs.classId) === form.classId),
    [feeStructures, form.classId]
  )

  const selectedFeeStructure = feeStructures.find(fs => fs._id === form.feeStructureId)
  const feeFrequency = normalizeFrequency(selectedFeeStructure?.feeHeads?.[0]?.frequency)
  const feeTotal = selectedFeeStructure?.totalAmount || selectedFeeStructure?.feeHeads?.reduce((sum, h) => sum + (h.amount || 0), 0) || 0

  const selectedClass = classes.find(c => c._id === form.classId)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setResult(null)

    if (!form.classId || !form.feeStructureId || !form.dueDate) {
      toast.error('Please fill all required fields')
      return
    }

    try {
      setIsSaving(true)
      const billingPeriod = buildBillingPeriod(feeFrequency, form)

      const res = await invoicesService.generateBulk({
        classId: form.classId,
        feeStructureId: form.feeStructureId,
        dueDate: form.dueDate,
        academicSessionId: activeSession._id,
        billingPeriod,
      })

      const data = res.data || res
      setResult({
        success: true,
        generated: data.generated || data.count || 0,
        skipped: data.skipped || 0,
        message: data.message || 'Invoices generated successfully',
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
      feeStructureId: '',
      dueDate: '',
      billingMonth: new Date().getMonth() + 1,
      billingQuarter: Math.ceil((new Date().getMonth() + 1) / 3),
      billingYear: new Date().getFullYear(),
    })
    setResult(null)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Class */}
      <div>
        <label className="label mb-1.5 block">Class *</label>
        <select
          className="input"
          value={form.classId}
          onChange={(e) => {
            setForm(prev => ({ ...prev, classId: e.target.value, feeStructureId: '' }))
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

      {/* Fee Structure */}
      <div>
        <label className="label mb-1.5 block">Fee Structure *</label>
        {form.classId && filteredStructures.length === 0 ? (
          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/30 rounded-xl">
            <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">No active fee structures for this class</p>
          </div>
        ) : (
          <select
            className="input"
            value={form.feeStructureId}
            onChange={(e) => { setForm(prev => ({ ...prev, feeStructureId: e.target.value })); setResult(null) }}
            required
            disabled={!form.classId}
          >
            <option value="">Select Fee Structure</option>
            {filteredStructures.map((structure) => {
              const total = structure.totalAmount || structure.feeHeads?.reduce((sum, h) => sum + (h.amount || 0), 0) || 0
              return (
                <option key={structure._id} value={structure._id}>
                  {formatCurrency(total)} — {structure.feeHeads?.length} fee heads
                </option>
              )
            })}
          </select>
        )}
      </div>

      {/* Fee preview */}
      {selectedFeeStructure && (
        <div className="bg-gray-50 dark:bg-[#2C2C2E] rounded-xl p-3 border border-gray-100 dark:border-[#38383A]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-[#636366] uppercase">Invoice Preview</span>
            <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(feeTotal)}</span>
          </div>
          <div className="space-y-1">
            {selectedFeeStructure.feeHeads?.map((h, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-gray-600 dark:text-[#8E8E93]">{h.name}</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(h.amount)}</span>
              </div>
            ))}
          </div>
          {selectedClass && (
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-[#38383A]">
              <div className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-gray-400 dark:text-[#636366]" />
                <span className="text-xs text-gray-500 dark:text-[#636366]">
                  {selectedClass.name} &middot; All students will receive this invoice
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Billing Period */}
      {form.feeStructureId && feeFrequency !== 'One-time' && (
        <div className="bg-blue-50 dark:bg-blue-900/15 border border-blue-200 dark:border-blue-800/30 rounded-xl p-3 space-y-2">
          <label className="block text-xs font-semibold text-blue-900 dark:text-blue-300">
            Billing Period ({feeFrequency})
          </label>
          <BillingPeriodSelector frequency={feeFrequency} form={form} setForm={setForm} />
        </div>
      )}

      {/* Due Date */}
      <div>
        <label className="label mb-1.5 block">Due Date *</label>
        <input
          type="date"
          className="input"
          value={form.dueDate}
          onChange={(e) => { setForm(prev => ({ ...prev, dueDate: e.target.value })); setResult(null) }}
          min={new Date().toISOString().split('T')[0]}
          required
        />
      </div>

      {/* Result feedback */}
      {result && (
        <div className={`flex items-start gap-2.5 p-3 rounded-xl border ${
          result.success
            ? 'bg-green-50 dark:bg-green-900/15 border-green-200 dark:border-green-800/30'
            : 'bg-red-50 dark:bg-red-900/15 border-red-200 dark:border-red-800/30'
        }`}>
          {result.success ? (
            <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <p className={`text-sm font-medium ${result.success ? 'text-green-800 dark:text-green-300' : 'text-red-800 dark:text-red-300'}`}>
              {result.message}
            </p>
            {result.success && (result.generated > 0 || result.skipped > 0) && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                {result.generated} generated{result.skipped > 0 ? `, ${result.skipped} skipped (already exist)` : ''}
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
          disabled={isSaving || !form.classId || !form.feeStructureId}
        >
          {isSaving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Generating Invoices...
            </span>
          ) : (
            'Generate Bulk Invoices'
          )}
        </button>
      )}
    </form>
  )
}

export default BulkInvoiceForm
