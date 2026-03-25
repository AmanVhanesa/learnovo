import React, { useState, useEffect } from 'react'
import ModalWrapper from '../ModalWrapper'
import toast from 'react-hot-toast'

const ICON_OPTIONS = [
  'GraduationCap', 'Heart', 'Award', 'Building2', 'Calendar',
  'TrendingUp', 'CircleDollarSign', 'Gift', 'Landmark', 'MoreHorizontal'
]

const COLOR_OPTIONS = [
  '#3B82F6', '#EC4899', '#8B5CF6', '#F59E0B', '#10B981',
  '#06B6D4', '#F97316', '#6366F1', '#EF4444', '#6B7280'
]

const CategoryFormModal = ({ category, onClose, onSave }) => {
  const isEdit = !!category
  const [form, setForm] = useState({ name: '', icon: 'CircleDollarSign', color: '#3B82F6' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (category) {
      setForm({ name: category.name || '', icon: category.icon || 'CircleDollarSign', color: category.color || '#3B82F6' })
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
    <ModalWrapper title={isEdit ? 'Edit Category' : 'Add Income Category'} onClose={onClose} maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        <div>
          <label className="label mb-1.5">Category Name <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
            className="input"
            placeholder="e.g., Donations"
            required
            autoFocus
          />
        </div>

        <div>
          <label className="label mb-2">Color</label>
          <div className="flex flex-wrap gap-2">
            {COLOR_OPTIONS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setForm(prev => ({ ...prev, color: c }))}
                className={`w-8 h-8 rounded-lg transition-all ${form.color === c ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-[#1C1C1E] scale-110' : 'hover:scale-105'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-[#2C2C2E]">
          <button type="button" onClick={onClose} className="btn btn-outline">Cancel</button>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  )
}

export default CategoryFormModal
