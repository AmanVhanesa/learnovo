import React, { useState } from 'react'
import { Trash2, AlertTriangle, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { invoicesService } from '../../services/feesService'

const BulkDeleteInvoiceForm = ({ classes, activeSession, onSuccess }) => {
  const [mode, setMode] = useState('class') // 'class' or 'all'
  const [form, setForm] = useState({ classId: '', sectionId: '' })
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [previewCount, setPreviewCount] = useState(null)

  const selectedClass = classes.find(c => c._id === form.classId)
  const sections = selectedClass?.sections || []

  const handleModeChange = (newMode) => {
    setMode(newMode)
    setForm({ classId: '', sectionId: '' })
    setPreviewCount(null)
  }

  const handleClassChange = (e) => {
    setForm({ classId: e.target.value, sectionId: '' })
    setPreviewCount(null)
  }

  const handlePreview = async () => {
    if (mode === 'class' && !form.classId) {
      toast.error('Please select a class')
      return
    }

    try {
      setIsPreviewing(true)
      const filters = {
        academicSessionId: activeSession._id,
        status: 'Pending',
      }
      if (mode === 'class') {
        filters.classId = form.classId
      }
      const res = await invoicesService.list(filters)
      const data = res.data || res
      setPreviewCount(Array.isArray(data) ? data.length : data.total || 0)
    } catch (error) {
      toast.error('Failed to fetch invoice count')
    } finally {
      setIsPreviewing(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (mode === 'class' && !form.classId) {
      toast.error('Please select a class')
      return
    }

    if (previewCount === null) {
      toast.error('Please preview first to see how many invoices will be deleted')
      return
    }

    if (previewCount === 0) {
      toast.error('No pending invoices found')
      return
    }

    const confirmMsg = mode === 'all'
      ? `Are you sure you want to delete ALL ${previewCount} pending invoice(s) across all classes? This cannot be undone.`
      : `Are you sure you want to delete ${previewCount} pending invoice(s) for this class? This cannot be undone.`

    if (!window.confirm(confirmMsg)) {
      return
    }

    // Double confirm for delete all
    if (mode === 'all') {
      if (!window.confirm(`FINAL CONFIRMATION: This will permanently cancel ${previewCount} pending invoice(s) across ALL classes. Are you absolutely sure?`)) {
        return
      }
    }

    try {
      setIsDeleting(true)
      const payload = {
        academicSessionId: activeSession._id,
      }
      if (mode === 'all') {
        payload.deleteAll = true
      } else {
        payload.classId = form.classId
        if (form.sectionId) payload.sectionId = form.sectionId
      }

      await invoicesService.deleteBulk(payload)

      toast.success(`Successfully deleted ${previewCount} pending invoice(s)`)
      setForm({ classId: '', sectionId: '' })
      setPreviewCount(null)
      onSuccess()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete invoices')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handleModeChange('class')}
          className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
            mode === 'class'
              ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800/40 text-red-700 dark:text-red-400'
              : 'bg-gray-50 dark:bg-[#2C2C2E] border-gray-200 dark:border-[#38383A] text-gray-600 dark:text-[#8E8E93] hover:bg-gray-100 dark:hover:bg-[#38383A]'
          }`}
        >
          By Class
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('all')}
          className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
            mode === 'all'
              ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800/40 text-red-700 dark:text-red-400'
              : 'bg-gray-50 dark:bg-[#2C2C2E] border-gray-200 dark:border-[#38383A] text-gray-600 dark:text-[#8E8E93] hover:bg-gray-100 dark:hover:bg-[#38383A]'
          }`}
        >
          All Classes
        </button>
      </div>

      {/* Class & Section Selection (only in class mode) */}
      {mode === 'class' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label mb-1.5 block">Class *</label>
            <select
              className="input"
              value={form.classId}
              onChange={handleClassChange}
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
              onChange={(e) => { setForm(prev => ({ ...prev, sectionId: e.target.value })); setPreviewCount(null) }}
              disabled={!form.classId || sections.length === 0}
            >
              <option value="">All Sections</option>
              {sections.map((sec) => (
                <option key={sec._id || sec.name} value={sec._id || sec.name}>{sec.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Warning for delete all */}
      {mode === 'all' && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/30 rounded-xl">
          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            This will delete all pending invoices with no payments across <strong>every class</strong> for the current academic session.
          </p>
        </div>
      )}

      {/* Preview Button */}
      {(mode === 'all' || form.classId) && previewCount === null && (
        <button
          type="button"
          onClick={handlePreview}
          disabled={isPreviewing}
          className="w-full btn btn-outline flex items-center justify-center gap-2"
        >
          <Search className="h-3.5 w-3.5" />
          {isPreviewing ? 'Checking...' : 'Preview Invoices to Delete'}
        </button>
      )}

      {/* Preview Result */}
      {previewCount !== null && (
        <div className={`rounded-xl p-3.5 border ${
          previewCount > 0
            ? 'bg-red-50 dark:bg-red-900/15 border-red-200 dark:border-red-800/30'
            : 'bg-green-50 dark:bg-green-900/15 border-green-200 dark:border-green-800/30'
        }`}>
          {previewCount > 0 ? (
            <div className="flex items-center gap-2.5">
              <Trash2 className="h-5 w-5 text-red-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                  {previewCount} pending invoice(s) will be deleted
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                  Only invoices with no payments will be removed
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm font-medium text-green-800 dark:text-green-300">
              No pending invoices found{mode === 'class' ? ' for this class' : ''}
            </p>
          )}
          <button
            type="button"
            onClick={() => setPreviewCount(null)}
            className="text-xs text-gray-500 dark:text-[#8E8E93] underline mt-2 block"
          >
            Re-check
          </button>
        </div>
      )}

      {/* Delete Button */}
      {previewCount !== null && previewCount > 0 && (
        <button
          type="submit"
          className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 font-medium text-sm transition-colors"
          disabled={isDeleting}
        >
          <Trash2 className="h-4 w-4" />
          {isDeleting ? 'Deleting...' : `Delete ${previewCount} Pending Invoice(s)`}
        </button>
      )}

      <p className="text-[11px] text-gray-400 dark:text-[#636366] text-center">
        Only pending invoices with no payments will be deleted.
      </p>
    </form>
  )
}

export default BulkDeleteInvoiceForm
