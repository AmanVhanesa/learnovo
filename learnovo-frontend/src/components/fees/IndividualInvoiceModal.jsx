import React, { useState, useMemo } from 'react'
import { FileText, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { invoicesService } from '../../services/feesService'
import { buildBillingPeriod, normalizeFrequency } from '../../utils/billingPeriod'
import { formatCurrency } from '../../utils/formatCurrency'
import ModalWrapper from '../ModalWrapper'
import StudentSearch from './StudentSearch'
import BillingPeriodSelector from './BillingPeriodSelector'

const IndividualInvoiceModal = ({ feeStructures, activeSession, onClose, onSuccess }) => {
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [form, setForm] = useState({
    feeStructureId: '',
    dueDate: '',
    billingMonth: new Date().getMonth() + 1,
    billingQuarter: Math.ceil((new Date().getMonth() + 1) / 3),
    billingYear: new Date().getFullYear(),
  })
  const [isSaving, setIsSaving] = useState(false)

  const selectedFeeStructure = feeStructures.find(fs => fs._id === form.feeStructureId)
  const feeFrequency = normalizeFrequency(selectedFeeStructure?.feeHeads?.[0]?.frequency)

  const activeFeeStructures = useMemo(
    () => feeStructures.filter(fs => fs.isActive),
    [feeStructures]
  )

  // Auto-filter structures matching student's class
  const studentClassId = typeof selectedStudent?.classId === 'object' ? selectedStudent.classId?._id : selectedStudent?.classId
  const matchingStructures = useMemo(() => {
    if (!studentClassId) return activeFeeStructures
    return activeFeeStructures.filter(fs => {
      const fsClassId = typeof fs.classId === 'object' ? fs.classId._id : fs.classId
      return fsClassId === studentClassId
    })
  }, [activeFeeStructures, studentClassId])

  // Filter out admission fees for imported students
  const applicableFeeHeads = useMemo(() => {
    if (!selectedFeeStructure?.feeHeads) return []
    if (selectedStudent?.isImported || selectedStudent?.admissionFeePaid) {
      return selectedFeeStructure.feeHeads.filter(h => !h.isAdmissionFee)
    }
    return selectedFeeStructure.feeHeads
  }, [selectedFeeStructure, selectedStudent])

  const feeHeadTotal = useMemo(
    () => applicableFeeHeads.reduce((sum, h) => sum + (h.amount || 0), 0),
    [applicableFeeHeads]
  )

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!selectedStudent) {
      toast.error('Please select a student')
      return
    }
    if (!form.feeStructureId) {
      toast.error('Please select a fee structure')
      return
    }
    if (!form.dueDate) {
      toast.error('Please select a due date')
      return
    }

    try {
      setIsSaving(true)
      const billingPeriod = buildBillingPeriod(feeFrequency, form)

      await invoicesService.generate({
        studentId: selectedStudent._id,
        feeStructureId: form.feeStructureId,
        dueDate: form.dueDate,
        academicSessionId: activeSession._id,
        billingPeriod,
      })
      onSuccess()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to generate invoice')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <ModalWrapper title="Generate Individual Invoice" onClose={onClose}>
      <form onSubmit={handleSubmit} className="p-4 sm:p-6">
        <div className="space-y-5">
          {/* Student Search */}
          <div>
            <label className="label mb-1.5 block">Select Student *</label>
            <StudentSearch onSelectStudent={(student) => {
              setSelectedStudent(student)
              // Auto-select fee structure matching student's class
              const studentClassId = typeof student?.classId === 'object' ? student.classId._id : student?.classId
              if (studentClassId) {
                const matched = activeFeeStructures.filter(fs => {
                  const fsClassId = typeof fs.classId === 'object' ? fs.classId._id : fs.classId
                  return fs.isActive && fsClassId === studentClassId
                })
                setForm(f => ({ ...f, feeStructureId: matched.length === 1 ? matched[0]._id : '' }))
              } else {
                setForm(f => ({ ...f, feeStructureId: '' }))
              }
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
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedStudent(null); setForm(f => ({ ...f, feeStructureId: '' })) }}
                  className="text-xs text-gray-500 dark:text-[#636366] hover:text-red-500 dark:hover:text-red-400"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          {/* Fee Structure Selection */}
          <div>
            <label className="label mb-1.5 block">Fee Structure *</label>
            {matchingStructures.length === 0 ? (
              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/30 rounded-xl">
                <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  {selectedStudent ? 'No fee structures found for this student\'s class' : 'No active fee structures available'}
                </p>
              </div>
            ) : matchingStructures.length === 1 && selectedStudent ? (
              /* Auto-matched: show read-only info instead of dropdown */
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/15 border border-green-200 dark:border-green-800/30 rounded-xl">
                <FileText className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-green-800 dark:text-green-300">
                    {(() => {
                      const s = matchingStructures[0]
                      const total = s.totalAmount || s.feeHeads?.reduce((sum, h) => sum + (h.amount || 0), 0) || 0
                      const cn = typeof s.classId === 'object' ? s.classId?.name : ''
                      return `${cn ? `${cn} — ` : ''}${formatCurrency(total)} (${s.feeHeads?.length} heads)`
                    })()}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">Auto-selected based on student's class</p>
                </div>
              </div>
            ) : (
              <select
                className="input"
                value={form.feeStructureId}
                onChange={(e) => setForm(prev => ({ ...prev, feeStructureId: e.target.value }))}
                required
              >
                <option value="">Select Fee Structure</option>
                {matchingStructures.map((structure) => {
                  const total = structure.totalAmount || structure.feeHeads?.reduce((sum, h) => sum + (h.amount || 0), 0) || 0
                  const className = typeof structure.classId === 'object' ? structure.classId?.name : ''
                  return (
                    <option key={structure._id} value={structure._id}>
                      {className ? `${className} — ` : ''}{formatCurrency(total)} ({structure.feeHeads?.length} heads)
                    </option>
                  )
                })}
              </select>
            )}
          </div>

          {/* Fee Breakdown Preview */}
          {selectedFeeStructure && (
            <div className="bg-gray-50 dark:bg-[#2C2C2E] rounded-xl border border-gray-100 dark:border-[#38383A] overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-[#38383A] flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 dark:text-[#636366] uppercase tracking-wide flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Fee Breakdown
                </span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(feeHeadTotal)}</span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-[#38383A]">
                {applicableFeeHeads.map((head, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{head.name}</span>
                      {head.isCompulsory && (
                        <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded">
                          Required
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(head.amount)}</span>
                      <span className="text-xs text-gray-400 dark:text-[#636366] ml-1.5 capitalize">/ {head.frequency}</span>
                    </div>
                  </div>
                ))}
                {(selectedStudent?.isImported || selectedStudent?.admissionFeePaid) && selectedFeeStructure.feeHeads?.some(h => h.isAdmissionFee) && (
                  <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/15">
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {selectedStudent?.isImported
                        ? 'Admission fee excluded — imported students are exempt from one-time admission fees.'
                        : 'Admission fee excluded — this student has already been charged the admission fee.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Billing Period */}
          {form.feeStructureId && feeFrequency !== 'One-time' && (
            <div className="bg-blue-50 dark:bg-blue-900/15 border border-blue-200 dark:border-blue-800/30 rounded-xl p-4 space-y-3">
              <label className="block text-sm font-semibold text-blue-900 dark:text-blue-300">
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
              onChange={(e) => setForm(prev => ({ ...prev, dueDate: e.target.value }))}
              min={new Date().toISOString().split('T')[0]}
              required
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 pt-6 border-t border-gray-200 dark:border-[#38383A] mt-6">
          <button type="button" onClick={onClose} className="btn btn-outline w-full sm:w-auto">
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary w-full sm:w-auto"
            disabled={isSaving || !selectedStudent || !form.feeStructureId}
          >
            {isSaving ? 'Generating...' : 'Generate Invoice'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  )
}

export default IndividualInvoiceModal
