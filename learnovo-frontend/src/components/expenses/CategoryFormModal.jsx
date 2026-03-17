import React, { useState, useEffect } from 'react'
import ModalWrapper from '../ModalWrapper'
import toast from 'react-hot-toast'

const PRESET_COLORS = [
  '#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#EC4899',
  '#F97316', '#6366F1', '#6B7280', '#EF4444', '#14B8A6'
]

const CategoryFormModal = ({ category, onClose, onSave }) => {
  const isEdit = !!category
  const [form, setForm] = useState({ name: '', icon: 'Receipt', color: '#3EC4B1' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (category) {
      setForm({ name: category.name || '', icon: category.icon || 'Receipt', color: category.color || '#3EC4B1' })
    }
  }, [category])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('Category name is required')
      return
    }
    setSaving(true)
    try {
      await onSave(form)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalWrapper title={isEdit ? 'Edit Category' : 'Add Category'} onClose={onClose} maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="p-6">
        <div className="space-y-5">
          <div>
            <label className="label mb-1.5">Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              className="input"
              placeholder="e.g., Maintenance"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="label mb-2">Color</label>
            <div className="flex flex-wrap gap-2.5">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, color: c }))}
                  className={`w-9 h-9 rounded-xl transition-all duration-200 ${form.color === c ? 'ring-2 ring-offset-2 ring-primary-500 dark:ring-offset-dark-card scale-110' : 'hover:scale-105 ring-1 ring-black/5'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <div className="relative">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm(prev => ({ ...prev, color: e.target.value }))}
                  className="w-9 h-9 rounded-xl cursor-pointer border-0 p-0 bg-transparent"
                  title="Custom color"
                />
              </div>
            </div>
            {/* Preview */}
            <div className="mt-3 flex items-center gap-2.5">
              <span className="w-4 h-4 rounded-full" style={{ backgroundColor: form.color }} />
              <span className="text-xs text-gray-500 dark:text-[#8E8E93] font-mono">{form.color}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-gray-100 dark:border-[#2C2C2E]">
          <button type="button" onClick={onClose} className="btn btn-outline">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'Saving...' : isEdit ? 'Update Category' : 'Create Category'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  )
}

export default CategoryFormModal
