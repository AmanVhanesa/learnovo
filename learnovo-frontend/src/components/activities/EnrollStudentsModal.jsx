import React, { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Search, UserPlus, Check } from 'lucide-react'
import ModalWrapper from '../ModalWrapper'
import Button from '../Button'
import LoadingSpinner from '../LoadingSpinner'
import EmptyState from '../EmptyState'
import { activityProgramsService } from '../../services/activityProgramsService'
import { studentsService } from '../../services/studentsService'
import { academicSessionsService } from '../../services/academicsService'
import { formatCurrency } from '../../utils/formatCurrency'

const EnrollStudentsModal = ({ program, onClose, onEnrolled }) => {
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [selected, setSelected] = useState(new Set())
  const [academicSessionId, setAcademicSessionId] = useState('')
  const [monthlyFee, setMonthlyFee] = useState(String(program?.monthlyFee ?? ''))
  const [discountType, setDiscountType] = useState('none')
  const [discountValue, setDiscountValue] = useState('')
  const [enrolledFrom, setEnrolledFrom] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Load active academic session
  useEffect(() => {
    let cancelled = false
    academicSessionsService.getActive()
      .then(res => {
        if (!cancelled && res?.data?._id) setAcademicSessionId(res.data._id)
      })
      .catch(() => { /* leave blank — admin can fix via dropdown */ })
    return () => { cancelled = true }
  }, [])

  const { data: sessionsRes } = useQuery({
    queryKey: ['academic-sessions-list-enroll'],
    queryFn: async () => academicSessionsService.list(),
    staleTime: 5 * 60 * 1000
  })
  const sessions = sessionsRes?.data || []

  // Load students. We restrict to active students; admin can search/filter.
  const { data: studentsRes, isLoading } = useQuery({
    queryKey: ['enroll-students', search, classFilter],
    queryFn: async () => studentsService.list({
      search: search.trim() || undefined,
      class: classFilter || undefined,
      status: 'active',
      limit: 200,
      lightweight: true
    }),
    staleTime: 30 * 1000
  })
  const students = studentsRes?.data || []

  // Pull already-active enrollments for this activity so we can hide them.
  const { data: enrolledRes } = useQuery({
    queryKey: ['enroll-existing', program?._id],
    queryFn: async () => activityProgramsService.listEnrollments(program._id, { status: 'active' }),
    enabled: Boolean(program?._id),
    staleTime: 30 * 1000
  })
  const alreadyEnrolledIds = useMemo(() => {
    return new Set((enrolledRes?.data || []).map(e => String(e.student?._id || e.student)))
  }, [enrolledRes])

  const eligibleStudents = students.filter(s => !alreadyEnrolledIds.has(String(s._id)))

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const toggleAll = () => {
    if (selected.size === eligibleStudents.length) setSelected(new Set())
    else setSelected(new Set(eligibleStudents.map(s => s._id)))
  }

  const effectiveFee = useMemo(() => {
    const fee = Number(monthlyFee) || 0
    const val = Number(discountValue) || 0
    if (discountType === 'percent') return Math.max(0, Math.round(fee * (100 - Math.min(val, 100)) / 100))
    if (discountType === 'fixed') return Math.max(0, fee - val)
    return fee
  }, [monthlyFee, discountType, discountValue])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (selected.size === 0) return toast.error('Pick at least one student')
    if (!academicSessionId) return toast.error('Select an academic session')
    const fee = Number(monthlyFee)
    if (!Number.isFinite(fee) || fee < 0) return toast.error('Monthly fee is invalid')

    setSaving(true)
    try {
      const res = await activityProgramsService.enrollStudents(program._id, {
        studentIds: Array.from(selected),
        academicSessionId,
        monthlyFee: fee,
        discountType,
        discountValue: discountType === 'none' ? 0 : Number(discountValue) || 0,
        enrolledFrom,
        notes: notes.trim() || undefined
      })
      const { enrolled, skipped, failed } = res.data
      if (enrolled.length > 0) toast.success(`Enrolled ${enrolled.length} student(s)`)
      if (skipped.length > 0) toast(`${skipped.length} already enrolled — skipped`, { icon: 'ℹ️' })
      if (failed.length > 0) toast.error(`${failed.length} failed`)
      onEnrolled?.(res.data)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to enroll students')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalWrapper title={`Enroll Students — ${program?.name || ''}`} onClose={onClose} maxWidth="max-w-3xl">
      <form onSubmit={handleSubmit} className="flex flex-col h-full">
        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          {/* Fee/discount config */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="label">Academic Session *</label>
              <select className="input" value={academicSessionId} onChange={e => setAcademicSessionId(e.target.value)}>
                <option value="">— Select —</option>
                {sessions.map(s => (
                  <option key={s._id} value={s._id}>{s.name}{s.isActive ? ' (Active)' : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Enrolled From</label>
              <input type="date" className="input" value={enrolledFrom} onChange={e => setEnrolledFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">Monthly Fee (₹) *</label>
              <input type="number" min="0" className="input" required
                value={monthlyFee} onChange={e => setMonthlyFee(e.target.value)} />
            </div>

            <div>
              <label className="label">Discount</label>
              <select className="input" value={discountType} onChange={e => setDiscountType(e.target.value)}>
                <option value="none">None</option>
                <option value="percent">% off</option>
                <option value="fixed">₹ off</option>
              </select>
            </div>
            <div>
              <label className="label">Value</label>
              <input
                type="number" min="0" className="input"
                disabled={discountType === 'none'}
                value={discountValue} onChange={e => setDiscountValue(e.target.value)}
                placeholder={discountType === 'percent' ? '0-100' : '0'}
              />
            </div>
            <div className="sm:col-span-2 flex items-end">
              <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl px-3 py-2 w-full">
                <div className="text-xs text-gray-500 dark:text-[#8E8E93]">Effective per student / month</div>
                <div className="text-lg font-semibold text-primary-700 dark:text-primary-400">{formatCurrency(effectiveFee)}</div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-[#2C2C2E] pt-4">
            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text" className="input pl-10"
                  placeholder="Search by name or admission number"
                  value={search} onChange={e => setSearch(e.target.value)}
                />
              </div>
              <input
                type="text" className="input sm:w-40"
                placeholder="Class (optional)"
                value={classFilter} onChange={e => setClassFilter(e.target.value)}
              />
            </div>

            {isLoading ? (
              <LoadingSpinner />
            ) : eligibleStudents.length === 0 ? (
              <EmptyState
                icon={UserPlus}
                title="No matching students"
                description="Try a different search or clear filters. Already-enrolled students are hidden."
              />
            ) : (
              <div className="max-h-80 overflow-y-auto rounded-xl border border-gray-100 dark:border-[#2C2C2E]">
                <div className="sticky top-0 bg-gray-50 dark:bg-[#1C1C1E] px-3 py-2 flex items-center justify-between text-xs font-semibold text-gray-600 dark:text-[#8E8E93] border-b border-gray-100 dark:border-[#2C2C2E]">
                  <button type="button" onClick={toggleAll} className="hover:text-primary-600">
                    {selected.size === eligibleStudents.length ? 'Clear all' : 'Select all'}
                  </button>
                  <span>{selected.size} selected</span>
                </div>
                <ul>
                  {eligibleStudents.map(s => {
                    const checked = selected.has(s._id)
                    return (
                      <li key={s._id}>
                        <button
                          type="button"
                          onClick={() => toggle(s._id)}
                          className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${checked ? 'bg-primary-50/60 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-[#2C2C2E]'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${checked ? 'bg-primary-600 border-primary-600 text-white' : 'border-gray-300 dark:border-[#38383A]'}`}>
                              {checked && <Check className="w-3 h-3" />}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-white">{s.name}</div>
                              <div className="text-xs text-gray-500 dark:text-[#8E8E93]">
                                {s.admissionNumber || '—'}{s.class ? ` · Class ${s.class}` : ''}{s.section ? `-${s.section}` : ''}
                              </div>
                            </div>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>

          <div>
            <label className="label">Notes (optional)</label>
            <textarea className="input min-h-[60px]" maxLength={500}
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Any notes for this batch of enrollments" />
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-5 py-3 border-t border-gray-100 dark:border-[#2C2C2E] flex-shrink-0">
          <Button variant="ghost" type="button" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" type="submit" loading={saving} disabled={selected.size === 0}>
            Enroll {selected.size > 0 ? `${selected.size} student${selected.size > 1 ? 's' : ''}` : ''}
          </Button>
        </div>
      </form>
    </ModalWrapper>
  )
}

export default EnrollStudentsModal
