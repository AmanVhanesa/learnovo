import React, { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Calendar, Plus, Edit2, Trash2, X, ChevronLeft, ChevronRight,
  Sun, AlertTriangle, BookOpen, Star, Ban, Loader2
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { timetableService } from '../../services/timetableService'

const OVERRIDE_TYPES = [
  { value: 'holiday', label: 'Holiday', color: 'bg-red-500', textColor: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400', icon: Sun },
  { value: 'half_day', label: 'Half Day', color: 'bg-amber-500', textColor: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400', icon: AlertTriangle },
  { value: 'exam_day', label: 'Exam Day', color: 'bg-blue-500', textColor: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400', icon: BookOpen },
  { value: 'special_schedule', label: 'Special Schedule', color: 'bg-primary-500', textColor: 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400', icon: Star },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-gray-500', textColor: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', icon: Ban }
]

function getTypeConfig(type) {
  return OVERRIDE_TYPES.find(t => t.value === type) || OVERRIDE_TYPES[0]
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year, month) {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1 // Monday = 0
}

const SpecialDays = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const today = new Date()
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth())
  const [showModal, setShowModal] = useState(false)
  const [editingOverride, setEditingOverride] = useState(null)
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null)

  // Form state
  const [form, setForm] = useState({
    date: '',
    type: 'holiday',
    title: '',
    description: '',
    activeSlots: []
  })

  // Fetch overrides for the calendar month
  const monthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`
  const monthEnd = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${getDaysInMonth(currentYear, currentMonth)}`

  const { data: overridesData, isLoading } = useQuery({
    queryKey: ['timetable-overrides', currentYear, currentMonth],
    queryFn: () => timetableService.getOverrides({
      startDate: monthStart,
      endDate: monthEnd
    })
  })
  const overrides = overridesData?.data || overridesData || []

  const { data: calendarData } = useQuery({
    queryKey: ['timetable-override-calendar', currentYear, currentMonth],
    queryFn: () => timetableService.getOverrideCalendar({
      year: currentYear,
      month: currentMonth + 1
    })
  })

  // Build override map by date
  const overridesByDate = useMemo(() => {
    const map = {}
    const allOverrides = [...overrides, ...(calendarData?.data || calendarData || [])]
    allOverrides.forEach(o => {
      const dateStr = o.date ? new Date(o.date).toISOString().split('T')[0] : null
      if (dateStr) {
        if (!map[dateStr]) map[dateStr] = []
        // Avoid duplicates
        if (!map[dateStr].find(x => x._id === o._id)) {
          map[dateStr].push(o)
        }
      }
    })
    return map
  }, [overrides, calendarData])

  // Upcoming overrides sorted
  const upcomingOverrides = useMemo(() => {
    const todayStr = today.toISOString().split('T')[0]
    return overrides
      .filter(o => {
        const dateStr = o.date ? new Date(o.date).toISOString().split('T')[0] : ''
        return dateStr >= todayStr
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date))
  }, [overrides])

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data) => timetableService.createOverride(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['timetable-overrides'])
      queryClient.invalidateQueries(['timetable-override-calendar'])
      setShowModal(false)
      resetForm()
      toast.success('Override created')
    },
    onError: (err) => toast.error(err?.message || 'Failed to create override')
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => timetableService.updateOverride(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['timetable-overrides'])
      queryClient.invalidateQueries(['timetable-override-calendar'])
      setShowModal(false)
      resetForm()
      toast.success('Override updated')
    },
    onError: (err) => toast.error(err?.message || 'Failed to update override')
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => timetableService.deleteOverride(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['timetable-overrides'])
      queryClient.invalidateQueries(['timetable-override-calendar'])
      toast.success('Override deleted')
    },
    onError: (err) => toast.error(err?.message || 'Failed to delete override')
  })

  // Handlers
  const resetForm = () => {
    setForm({ date: '', type: 'holiday', title: '', description: '', activeSlots: [] })
    setEditingOverride(null)
    setSelectedCalendarDate(null)
  }

  const openModal = (override = null, date = null) => {
    if (override) {
      setEditingOverride(override)
      setForm({
        date: override.date ? new Date(override.date).toISOString().split('T')[0] : '',
        type: override.type || 'holiday',
        title: override.title || '',
        description: override.description || '',
        activeSlots: override.activeSlots || []
      })
    } else {
      setEditingOverride(null)
      setForm({
        date: date || '',
        type: 'holiday',
        title: '',
        description: '',
        activeSlots: []
      })
    }
    setShowModal(true)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.date || !form.title.trim()) {
      return toast.error('Date and title are required')
    }
    const data = {
      ...form,
      activeSlots: form.type === 'half_day' ? form.activeSlots : undefined
    }
    if (editingOverride) {
      updateMutation.mutate({ id: editingOverride._id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const handleCalendarDateClick = (day) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const existing = overridesByDate[dateStr]
    if (existing && existing.length > 0) {
      openModal(existing[0])
    } else {
      openModal(null, dateStr)
    }
  }

  const navigateMonth = (direction) => {
    let newMonth = currentMonth + direction
    let newYear = currentYear
    if (newMonth < 0) { newMonth = 11; newYear-- }
    if (newMonth > 11) { newMonth = 0; newYear++ }
    setCurrentMonth(newMonth)
    setCurrentYear(newYear)
  }

  // Calendar data
  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth)
  const monthName = new Date(currentYear, currentMonth).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  const todayDate = today.getDate()
  const isCurrentMonth = today.getFullYear() === currentYear && today.getMonth() === currentMonth
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  const inputClass = 'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 focus:outline-none'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-primary-600" />
            Special Days & Overrides
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">Manage holidays, half-days, and special schedules</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Override
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {OVERRIDE_TYPES.map(type => (
          <div key={type.value} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-full ${type.color}`} />
            <span className="text-xs text-gray-500 dark:text-gray-400">{type.label}</span>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A]">
        {/* Month Navigation */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-[#38383A]">
          <button
            onClick={() => navigateMonth(-1)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2C2C2E] text-gray-600 dark:text-gray-400 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{monthName}</h2>
          <button
            onClick={() => navigateMonth(1)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2C2C2E] text-gray-600 dark:text-gray-400 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="p-4">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map(day => (
              <div key={day} className="text-center text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          {isLoading ? (
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse bg-gray-100 dark:bg-gray-800 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells for days before first day */}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}

              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const dayOverrides = overridesByDate[dateStr] || []
                const hasOverride = dayOverrides.length > 0
                const isToday = isCurrentMonth && day === todayDate
                const primaryType = hasOverride ? getTypeConfig(dayOverrides[0].type) : null

                return (
                  <button
                    key={day}
                    onClick={() => handleCalendarDateClick(day)}
                    className={`aspect-square rounded-lg flex flex-col items-center justify-center relative transition-all hover:scale-105 ${
                      isToday
                        ? 'ring-2 ring-primary-500 ring-offset-1 dark:ring-offset-[#1C1C1E]'
                        : ''
                    } ${
                      hasOverride
                        ? 'hover:shadow-md'
                        : 'hover:bg-gray-50 dark:hover:bg-[#2C2C2E]'
                    }`}
                  >
                    <span className={`text-sm font-medium ${
                      isToday
                        ? 'text-primary-600 dark:text-primary-400'
                        : hasOverride
                          ? 'text-gray-900 dark:text-white'
                          : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {day}
                    </span>
                    {hasOverride && (
                      <div className="flex gap-0.5 mt-0.5">
                        {dayOverrides.slice(0, 3).map((o, idx) => {
                          const cfg = getTypeConfig(o.type)
                          return <div key={idx} className={`w-1.5 h-1.5 rounded-full ${cfg.color}`} />
                        })}
                      </div>
                    )}
                    {hasOverride && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary-500 hidden sm:block" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Upcoming Overrides Table */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A]">
        <div className="p-4 border-b border-gray-100 dark:border-[#38383A]">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
            Upcoming Overrides
          </h3>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg" />
            ))}
          </div>
        ) : overrides.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Calendar className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400 mb-1">No overrides for this month</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Click on a date or use the button above to add one.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-[#2C2C2E]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">Description</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#38383A]">
                {overrides
                  .sort((a, b) => new Date(a.date) - new Date(b.date))
                  .map(override => {
                    const typeConfig = getTypeConfig(override.type)
                    const Icon = typeConfig.icon
                    const dateObj = override.date ? new Date(override.date) : null
                    const isPast = dateObj && dateObj < new Date(today.toISOString().split('T')[0])

                    return (
                      <tr key={override._id} className={`hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors ${isPast ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${typeConfig.color}`} />
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {dateObj ? dateObj.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' }) : '-'}
                              </p>
                              <p className="text-[10px] text-gray-400 dark:text-gray-500">{dateObj?.getFullYear()}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${typeConfig.textColor}`}>
                            <Icon className="w-3 h-3" />
                            {typeConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                          {override.title || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 hidden sm:table-cell truncate max-w-[200px]">
                          {override.description || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openModal(override)}
                              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#3A3A3C] text-gray-400 transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => { if (confirm('Delete this override?')) deleteMutation.mutate(override._id) }}
                              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Override Modal */}
      {showModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setShowModal(false); resetForm() }} />
          <div className="relative bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-[#38383A]">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingOverride ? 'Edit Override' : 'Add Override'}
              </h3>
              <button onClick={() => { setShowModal(false); resetForm() }} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2C2C2E] text-gray-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date *</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type *</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {OVERRIDE_TYPES.map(type => {
                    const Icon = type.icon
                    const isSelected = form.type === type.value
                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, type: type.value }))}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-sm font-medium transition-all ${
                          isSelected
                            ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 ring-1 ring-primary-200 dark:ring-primary-800'
                            : 'border-gray-200 dark:border-[#38383A] text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#2C2C2E]'
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full ${type.color}`} />
                        <Icon className="w-3.5 h-3.5" />
                        <span className="text-xs">{type.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                  className={inputClass}
                  placeholder="e.g. Republic Day, Parent-Teacher Meeting"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  className={inputClass}
                  rows={2}
                  placeholder="Optional details about this override"
                />
              </div>

              {/* Half Day: Active Slots */}
              {form.type === 'half_day' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Active Timing Slots
                  </label>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                    Select which periods should remain active during the half day.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 8 }).map((_, i) => {
                      const slot = i + 1
                      const isActive = form.activeSlots.includes(slot)
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => {
                            setForm(f => ({
                              ...f,
                              activeSlots: isActive
                                ? f.activeSlots.filter(s => s !== slot)
                                : [...f.activeSlots, slot].sort((a, b) => a - b)
                            }))
                          }}
                          className={`w-10 h-10 rounded-lg text-sm font-medium border transition-colors ${
                            isActive
                              ? 'bg-primary-600 text-white border-primary-600'
                              : 'bg-gray-50 dark:bg-[#2C2C2E] text-gray-500 dark:text-gray-400 border-gray-200 dark:border-[#38383A] hover:bg-gray-100 dark:hover:bg-[#3A3A3C]'
                          }`}
                        >
                          P{slot}
                        </button>
                      )
                    })}
                  </div>
                  {form.activeSlots.length > 0 && (
                    <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">
                      Active: Periods {form.activeSlots.join(', ')}
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-between items-center pt-2">
                {editingOverride && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Delete this override?')) {
                        deleteMutation.mutate(editingOverride._id)
                        setShowModal(false)
                        resetForm()
                      }
                    }}
                    className="px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                )}
                <div className="flex gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); resetForm() }}
                    className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2C2C2E] rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isLoading || updateMutation.isLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
                  >
                    {(createMutation.isLoading || updateMutation.isLoading) && <Loader2 className="w-4 h-4 animate-spin" />}
                    {(createMutation.isLoading || updateMutation.isLoading) ? 'Saving...' : editingOverride ? 'Update' : 'Create'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default SpecialDays
