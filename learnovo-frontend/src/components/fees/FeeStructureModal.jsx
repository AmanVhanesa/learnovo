import React, { useState, useMemo } from 'react'
import { Plus, Trash2, GripVertical, Copy, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { feeStructuresService } from '../../services/feesService'
import { formatCurrency } from '../../utils/formatCurrency'
import ModalWrapper from '../ModalWrapper'

const FREQUENCY_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'half-yearly', label: 'Half-Yearly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'one-time', label: 'One-time' },
]

const DEFAULT_FEE_HEAD = { name: '', amount: 0, frequency: 'monthly', isCompulsory: true, dueDay: 5 }

const PRESET_FEE_HEADS = [
  { name: 'Tuition Fee', amount: 0, frequency: 'monthly', isCompulsory: true, dueDay: 5 },
  { name: 'Admission Fee', amount: 0, frequency: 'one-time', isCompulsory: true, dueDay: 5 },
  { name: 'Exam Fee', amount: 0, frequency: 'half-yearly', isCompulsory: true, dueDay: 5 },
  { name: 'Library Fee', amount: 0, frequency: 'yearly', isCompulsory: false, dueDay: 5 },
  { name: 'Transport Fee', amount: 0, frequency: 'monthly', isCompulsory: false, dueDay: 5 },
  { name: 'Lab Fee', amount: 0, frequency: 'yearly', isCompulsory: false, dueDay: 5 },
  { name: 'Sports Fee', amount: 0, frequency: 'yearly', isCompulsory: false, dueDay: 5 },
  { name: 'Computer Fee', amount: 0, frequency: 'monthly', isCompulsory: false, dueDay: 5 },
]

const FeeStructureModal = ({ feeStructure, classes, activeSession, onClose, onSuccess }) => {
  const [form, setForm] = useState({
    classId: feeStructure?.classId?._id || '',
    sectionId: feeStructure?.sectionId?._id || '',
    academicSessionId: activeSession?._id || '',
    feeHeads: feeStructure?.feeHeads?.length > 0
      ? feeStructure.feeHeads.map(h => ({ ...h }))
      : [{ ...PRESET_FEE_HEADS[0] }],
    isActive: feeStructure?.isActive ?? true,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState({})

  const selectedClass = classes.find(c => c._id === form.classId)
  const sections = selectedClass?.sections || []

  const totalAmount = useMemo(
    () => form.feeHeads.reduce((sum, h) => sum + (Number(h.amount) || 0), 0),
    [form.feeHeads]
  )

  const compulsoryTotal = useMemo(
    () => form.feeHeads.filter(h => h.isCompulsory).reduce((sum, h) => sum + (Number(h.amount) || 0), 0),
    [form.feeHeads]
  )

  const addFeeHead = () => {
    setForm(prev => ({
      ...prev,
      feeHeads: [...prev.feeHeads, { ...DEFAULT_FEE_HEAD }],
    }))
  }

  const addPresetFeeHead = (preset) => {
    const exists = form.feeHeads.some(h => h.name.toLowerCase() === preset.name.toLowerCase())
    if (exists) {
      toast.error(`"${preset.name}" already exists`)
      return
    }
    setForm(prev => ({
      ...prev,
      feeHeads: [...prev.feeHeads, { ...preset }],
    }))
  }

  const removeFeeHead = (index) => {
    if (form.feeHeads.length <= 1) {
      toast.error('At least one fee head is required')
      return
    }
    setForm(prev => ({
      ...prev,
      feeHeads: prev.feeHeads.filter((_, i) => i !== index),
    }))
  }

  const duplicateFeeHead = (index) => {
    const head = form.feeHeads[index]
    setForm(prev => ({
      ...prev,
      feeHeads: [
        ...prev.feeHeads.slice(0, index + 1),
        { ...head, name: `${head.name} (Copy)` },
        ...prev.feeHeads.slice(index + 1),
      ],
    }))
  }

  const updateFeeHead = (index, field, value) => {
    setForm(prev => {
      const updated = [...prev.feeHeads]
      updated[index] = { ...updated[index], [field]: value }
      return { ...prev, feeHeads: updated }
    })
    if (errors[`feeHead_${index}_${field}`]) {
      setErrors(prev => {
        const next = { ...prev }
        delete next[`feeHead_${index}_${field}`]
        return next
      })
    }
  }

  const validate = () => {
    const newErrors = {}
    if (!form.classId) newErrors.classId = 'Class is required'
    if (form.feeHeads.length === 0) newErrors.feeHeads = 'At least one fee head is required'

    form.feeHeads.forEach((head, i) => {
      if (!head.name.trim()) newErrors[`feeHead_${i}_name`] = 'Name is required'
      if (!head.amount || Number(head.amount) <= 0) newErrors[`feeHead_${i}_amount`] = 'Amount must be > 0'
      if (head.dueDay < 1 || head.dueDay > 28) newErrors[`feeHead_${i}_dueDay`] = '1-28'
    })

    // Check for duplicate names
    const names = form.feeHeads.map(h => h.name.trim().toLowerCase())
    const seen = new Set()
    names.forEach((name, i) => {
      if (name && seen.has(name)) {
        newErrors[`feeHead_${i}_name`] = 'Duplicate name'
      }
      seen.add(name)
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) {
      toast.error('Please fix the errors before saving')
      return
    }

    try {
      setIsSaving(true)
      const payload = {
        ...form,
        sectionId: form.sectionId || null,
        feeHeads: form.feeHeads.map(h => ({
          ...h,
          amount: Number(h.amount),
          dueDay: Number(h.dueDay),
        })),
      }

      if (feeStructure) {
        await feeStructuresService.update(feeStructure._id, payload)
      } else {
        await feeStructuresService.create(payload)
      }
      onSuccess()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save fee structure')
    } finally {
      setIsSaving(false)
    }
  }

  const availablePresets = PRESET_FEE_HEADS.filter(
    p => !form.feeHeads.some(h => h.name.toLowerCase() === p.name.toLowerCase())
  )

  return (
    <ModalWrapper
      title={feeStructure ? 'Edit Fee Structure' : 'Create Fee Structure'}
      onClose={onClose}
      maxWidth="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="p-4 sm:p-6">
        <div className="space-y-6">
          {/* Class & Section Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label mb-1.5 block">Class *</label>
              <select
                className={`input ${errors.classId ? 'border-red-400 dark:border-red-500 focus:ring-red-500' : ''}`}
                value={form.classId}
                onChange={(e) => {
                  setForm(prev => ({ ...prev, classId: e.target.value, sectionId: '' }))
                  if (errors.classId) setErrors(prev => ({ ...prev, classId: undefined }))
                }}
              >
                <option value="">Select Class</option>
                {classes.map((cls) => (
                  <option key={cls._id} value={cls._id}>{cls.name}</option>
                ))}
              </select>
              {errors.classId && <p className="text-xs text-red-500 mt-1">{errors.classId}</p>}
            </div>
            <div>
              <label className="label mb-1.5 block">Section</label>
              <select
                className="input"
                value={form.sectionId}
                onChange={(e) => setForm(prev => ({ ...prev, sectionId: e.target.value }))}
                disabled={!form.classId || sections.length === 0}
              >
                <option value="">All Sections</option>
                {sections.map((sec) => (
                  <option key={sec._id || sec.name} value={sec._id || sec.name}>{sec.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Fee Heads */}
          <div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3">
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white">Fee Heads *</label>
                <p className="text-xs text-gray-500 dark:text-[#636366] mt-0.5">
                  {form.feeHeads.length} head{form.feeHeads.length !== 1 ? 's' : ''} &middot; Total: {formatCurrency(totalAmount)}
                </p>
              </div>
              <button
                type="button"
                onClick={addFeeHead}
                className="btn btn-sm btn-outline flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Fee Head
              </button>
            </div>

            {/* Quick-add presets */}
            {availablePresets.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                <span className="text-xs text-gray-500 dark:text-[#636366] self-center mr-1">Quick add:</span>
                {availablePresets.slice(0, 5).map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => addPresetFeeHead(preset)}
                    className="px-2.5 py-1 text-xs font-medium bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 border border-primary-200 dark:border-primary-800/30 transition-colors"
                  >
                    + {preset.name}
                  </button>
                ))}
              </div>
            )}

            {errors.feeHeads && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg mb-3">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700 dark:text-red-400">{errors.feeHeads}</p>
              </div>
            )}

            <div className="space-y-3">
              {form.feeHeads.map((head, index) => (
                <div
                  key={index}
                  className={`border rounded-xl p-3 sm:p-4 transition-colors ${
                    Object.keys(errors).some(k => k.startsWith(`feeHead_${index}`))
                      ? 'border-red-300 dark:border-red-500/50 bg-red-50/50 dark:bg-red-900/10'
                      : 'border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#1C1C1E]'
                  }`}
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-gray-300 dark:text-[#636366]" />
                      <span className="text-xs font-semibold text-gray-500 dark:text-[#636366] uppercase tracking-wide">
                        Fee Head #{index + 1}
                      </span>
                      {head.isCompulsory && (
                        <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded">
                          Required
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => duplicateFeeHead(index)}
                        className="p-1.5 text-gray-400 dark:text-[#636366] hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                        title="Duplicate"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFeeHead(index)}
                        className="p-1.5 text-gray-400 dark:text-[#636366] hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-[#8E8E93] mb-1">Name *</label>
                      <input
                        type="text"
                        className={`input text-sm ${errors[`feeHead_${index}_name`] ? 'border-red-400 dark:border-red-500' : ''}`}
                        value={head.name}
                        onChange={(e) => updateFeeHead(index, 'name', e.target.value)}
                        placeholder="e.g., Tuition Fee"
                      />
                      {errors[`feeHead_${index}_name`] && (
                        <p className="text-xs text-red-500 mt-0.5">{errors[`feeHead_${index}_name`]}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-[#8E8E93] mb-1">Amount *</label>
                      <input
                        type="number"
                        className={`input text-sm ${errors[`feeHead_${index}_amount`] ? 'border-red-400 dark:border-red-500' : ''}`}
                        value={head.amount || ''}
                        onChange={(e) => updateFeeHead(index, 'amount', e.target.value === '' ? '' : Number(e.target.value))}
                        onWheel={(e) => e.target.blur()}
                        placeholder="0"
                        min="0"
                        step="1"
                      />
                      {errors[`feeHead_${index}_amount`] && (
                        <p className="text-xs text-red-500 mt-0.5">{errors[`feeHead_${index}_amount`]}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-[#8E8E93] mb-1">Frequency</label>
                      <select
                        className="input text-sm"
                        value={head.frequency}
                        onChange={(e) => updateFeeHead(index, 'frequency', e.target.value)}
                      >
                        {FREQUENCY_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-[#8E8E93] mb-1">Due Day</label>
                      <input
                        type="number"
                        className={`input text-sm ${errors[`feeHead_${index}_dueDay`] ? 'border-red-400 dark:border-red-500' : ''}`}
                        value={head.dueDay}
                        onChange={(e) => updateFeeHead(index, 'dueDay', e.target.value === '' ? 1 : parseInt(e.target.value))}
                        onWheel={(e) => e.target.blur()}
                        min="1"
                        max="28"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1 flex items-end">
                      <label className="flex items-center gap-2 cursor-pointer pb-2">
                        <input
                          type="checkbox"
                          checked={head.isCompulsory}
                          onChange={(e) => updateFeeHead(index, 'isCompulsory', e.target.checked)}
                          className="rounded border-gray-300 dark:border-[#38383A] text-primary-600 focus:ring-primary-500 h-4 w-4"
                        />
                        <span className="text-xs font-medium text-gray-700 dark:text-[#8E8E93]">Compulsory</span>
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary Card */}
          <div className="bg-gray-50 dark:bg-[#2C2C2E] rounded-xl p-4 border border-gray-100 dark:border-[#38383A]">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-[10px] font-semibold text-gray-500 dark:text-[#636366] uppercase tracking-wide">Total Amount</p>
                <p className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">{formatCurrency(totalAmount)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-500 dark:text-[#636366] uppercase tracking-wide">Compulsory</p>
                <p className="text-lg font-bold text-primary-600 dark:text-primary-400 mt-0.5">{formatCurrency(compulsoryTotal)}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-500 dark:text-[#636366] uppercase tracking-wide">Optional</p>
                <p className="text-lg font-bold text-gray-600 dark:text-[#8E8E93] mt-0.5">{formatCurrency(totalAmount - compulsoryTotal)}</p>
              </div>
            </div>
          </div>

          {/* Active Status */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm(prev => ({ ...prev, isActive: e.target.checked }))}
                className="sr-only"
              />
              <div className={`w-10 h-6 rounded-full transition-colors ${form.isActive ? 'bg-primary-500' : 'bg-gray-300 dark:bg-[#38383A]'}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform mt-1 ${form.isActive ? 'translate-x-5' : 'translate-x-1'}`} />
              </div>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {form.isActive ? 'Active' : 'Inactive'}
              </span>
              <p className="text-xs text-gray-500 dark:text-[#636366]">
                {form.isActive ? 'This structure can be used for invoice generation' : 'This structure is disabled'}
              </p>
            </div>
          </label>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-6 border-t border-gray-200 dark:border-[#38383A] mt-6">
          <button type="button" onClick={onClose} className="btn btn-outline w-full sm:w-auto">
            Cancel
          </button>
          <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={isSaving}>
            {isSaving ? 'Saving...' : feeStructure ? 'Update Structure' : 'Create Structure'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  )
}

export default FeeStructureModal
