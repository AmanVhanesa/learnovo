import React, { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Music, Image as ImageIcon, Loader2 } from 'lucide-react'
import ModalWrapper from '../ModalWrapper'
import Button from '../Button'
import { activityProgramsService } from '../../services/activityProgramsService'
import api from '../../services/authService'

const CATEGORIES = ['Sports', 'Music', 'Dance', 'Arts', 'Academic', 'Other']

const emptyForm = {
  name: '',
  description: '',
  category: 'Other',
  monthlyFee: '',
  instructor: '',
  schedule: '',
  capacity: ''
}

const ActivityProgramFormModal = ({ program, onClose, onSaved }) => {
  const isEdit = Boolean(program)
  const [form, setForm] = useState(emptyForm)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  useEffect(() => {
    if (program) {
      setForm({
        name: program.name || '',
        description: program.description || '',
        category: program.category || 'Other',
        monthlyFee: program.monthlyFee ?? '',
        instructor: program.instructor?._id || program.instructor || '',
        schedule: program.schedule || '',
        capacity: program.capacity || ''
      })
      setPhotoPreview(program.photo || null)
    } else {
      setForm(emptyForm)
      setPhotoPreview(null)
    }
    setPhotoFile(null)
  }, [program])

  const { data: instructors = [] } = useQuery({
    queryKey: ['activity-instructors'],
    queryFn: async () => {
      // Fetch teacher-class roles only. Backend caps limit at 100.
      const roles = ['teacher', 'principal', 'vice_principal', 'admin']
      const results = await Promise.all(
        roles.map(role =>
          api.get('/employees', { params: { role, status: 'active', limit: 100 } })
            .then(r => r.data?.data || [])
            .catch(() => [])
        )
      )
      const merged = results.flat()
      const byId = new Map()
      for (const u of merged) byId.set(String(u._id), u)
      return Array.from(byId.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    },
    staleTime: 60 * 1000
  })

  const handleChange = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please pick an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5 MB')
      return
    }
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Name is required')
    const fee = Number(form.monthlyFee)
    if (!Number.isFinite(fee) || fee < 0) return toast.error('Monthly fee must be a valid number')

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      category: form.category,
      monthlyFee: fee,
      instructor: form.instructor || null,
      schedule: form.schedule.trim() || undefined,
      capacity: form.capacity ? Number(form.capacity) : 0
    }

    setSaving(true)
    try {
      let saved
      if (isEdit) {
        const res = await activityProgramsService.update(program._id, payload)
        saved = res.data
      } else {
        const res = await activityProgramsService.create(payload)
        saved = res.data
      }

      if (photoFile && saved?._id) {
        setUploadingPhoto(true)
        try {
          const res = await activityProgramsService.uploadPhoto(saved._id, photoFile)
          saved.photo = res.data?.photo
        } catch (err) {
          toast.error('Activity saved, but photo upload failed')
        } finally {
          setUploadingPhoto(false)
        }
      }

      toast.success(isEdit ? 'Activity updated' : 'Activity created')
      onSaved?.(saved)
      onClose()
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to save activity'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalWrapper title={isEdit ? 'Edit Activity' : 'New Activity'} onClose={onClose} maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="p-5 space-y-5">
        {/* Photo */}
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20 rounded-2xl bg-gray-100 dark:bg-[#2C2C2E] overflow-hidden flex-shrink-0 flex items-center justify-center">
            {photoPreview ? (
              <img src={photoPreview} alt="" className="w-full h-full object-cover" />
            ) : (
              <Music className="w-8 h-8 text-gray-400" />
            )}
          </div>
          <div>
            <label className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 dark:border-[#38383A] text-gray-700 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] cursor-pointer transition-colors">
              <ImageIcon className="w-3.5 h-3.5" />
              {photoPreview ? 'Change photo' : 'Add photo'}
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            </label>
            <p className="text-xs text-gray-400 mt-1">JPG or PNG. Max 5 MB.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label">Activity Name *</label>
            <input
              type="text" className="input" required maxLength={120}
              value={form.name} onChange={e => handleChange('name', e.target.value)}
              placeholder="e.g. Bharatnatyam, Karate, Keyboard"
            />
          </div>

          <div>
            <label className="label">Category</label>
            <select className="input" value={form.category} onChange={e => handleChange('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Monthly Fee (₹) *</label>
            <input
              type="number" min="0" step="1" className="input" required
              value={form.monthlyFee} onChange={e => handleChange('monthlyFee', e.target.value)}
              placeholder="e.g. 800"
            />
          </div>

          <div>
            <label className="label">Instructor</label>
            <select className="input" value={form.instructor} onChange={e => handleChange('instructor', e.target.value)}>
              <option value="">— None —</option>
              {instructors.map(u => (
                <option key={u._id} value={u._id}>
                  {u.name}{u.designation ? ` (${u.designation})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Capacity</label>
            <input
              type="number" min="0" step="1" className="input"
              value={form.capacity} onChange={e => handleChange('capacity', e.target.value)}
              placeholder="0 = unlimited"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="label">Schedule</label>
            <input
              type="text" className="input" maxLength={200}
              value={form.schedule} onChange={e => handleChange('schedule', e.target.value)}
              placeholder="e.g. Mon, Wed, Fri — 4:00 to 5:00 PM"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="label">Description</label>
            <textarea
              className="input min-h-[80px]" maxLength={1000}
              value={form.description} onChange={e => handleChange('description', e.target.value)}
              placeholder="Brief description of the activity, what students will learn, etc."
            />
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2 border-t border-gray-100 dark:border-[#2C2C2E]">
          <Button variant="ghost" type="button" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" type="submit" loading={saving || uploadingPhoto}>
            {uploadingPhoto ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading photo…</> : (isEdit ? 'Save Changes' : 'Create Activity')}
          </Button>
        </div>
      </form>
    </ModalWrapper>
  )
}

export default ActivityProgramFormModal
