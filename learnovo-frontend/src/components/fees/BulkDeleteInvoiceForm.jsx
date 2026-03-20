import React, { useState } from 'react'
import { Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { invoicesService } from '../../services/feesService'

const BulkDeleteInvoiceForm = ({ classes, activeSession, onSuccess }) => {
  const [form, setForm] = useState({ classId: '', sectionId: '' })
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [previewCount, setPreviewCount] = useState(null)

  const handleClassChange = (e) => {
    setForm({ ...form, classId: e.target.value, sectionId: '' })
    setPreviewCount(null)
  }

  const handlePreview = async () => {
    if (!form.classId) {
      toast.error('Please select a class')
      return
    }

    try {
      setIsPreviewing(true)
      const res = await invoicesService.list({
        classId: form.classId,
        academicSessionId: activeSession._id,
        status: 'Pending'
      })
      setPreviewCount((res.data || []).length)
    } catch (error) {
      toast.error('Failed to fetch invoice count')
    } finally {
      setIsPreviewing(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.classId) {
      toast.error('Please select a class')
      return
    }

    if (previewCount === null) {
      toast.error('Please preview first to see how many invoices will be deleted')
      return
    }

    if (previewCount === 0) {
      toast.error('No pending invoices found for this class')
      return
    }

    if (!window.confirm(`Are you sure you want to delete ${previewCount} pending invoice(s) for this class? This cannot be undone.`)) {
      return
    }

    try {
      setIsDeleting(true)
      await invoicesService.deleteBulk({
        classId: form.classId,
        sectionId: form.sectionId || undefined,
        academicSessionId: activeSession._id
      })

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
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-2">Class</label>
        <select
          className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-[#1C1C1E] dark:text-white"
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

      {form.classId && previewCount === null && (
        <button
          type="button"
          onClick={handlePreview}
          disabled={isPreviewing}
          className="w-full px-4 py-2 bg-gray-100 dark:bg-[#2C2C2E] text-gray-700 dark:text-[#8E8E93] rounded-lg hover:bg-gray-200 dark:hover:bg-[#38383A] disabled:opacity-50 flex items-center justify-center gap-2 border border-gray-300 dark:border-[#38383A]"
        >
          {isPreviewing ? 'Checking...' : 'Preview Invoices to Delete'}
        </button>
      )}

      {previewCount !== null && (
        <div className={`rounded-lg p-4 border ${previewCount > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
          {previewCount > 0 ? (
            <div className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-800">
                  {previewCount} pending invoice(s) will be deleted
                </p>
                <p className="text-xs text-red-600 mt-0.5">Only invoices with no payments will be removed</p>
              </div>
            </div>
          ) : (
            <p className="text-sm font-medium text-green-800">No pending invoices found for this class</p>
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

      {previewCount !== null && previewCount > 0 && (
        <button
          type="submit"
          className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
          disabled={isDeleting}
        >
          <Trash2 className="h-4 w-4" />
          {isDeleting ? 'Deleting...' : `Delete ${previewCount} Pending Invoice(s)`}
        </button>
      )}

      <p className="text-xs text-red-500 text-center">
        * Only pending invoices with no payments will be deleted.
      </p>
    </form>
  )
}

export default BulkDeleteInvoiceForm
