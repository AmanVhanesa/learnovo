import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  RefreshCw, Plus, UserMinus, Clock, CheckCircle, AlertCircle,
  X, ChevronDown, Users, Calendar, Search, Loader2
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { timetableService } from '../../services/timetableService'
import api from '../../services/authService'

const STATUS_CONFIG = {
  pending: { label: 'Pending', bg: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' },
  assigned: { label: 'Assigned', bg: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' },
  completed: { label: 'Completed', bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' },
  cancelled: { label: 'Cancelled', bg: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' }
}

const Substitutions = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const isAdmin = user?.role === 'admin'
  const isTeacher = user?.role === 'teacher'

  // State
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [statusFilter, setStatusFilter] = useState('all')
  const [showAbsentModal, setShowAbsentModal] = useState(false)
  const [showAssignDropdown, setShowAssignDropdown] = useState(null)
  const [showReportModal, setShowReportModal] = useState(false)

  // Absent modal state
  const [absentTeacherId, setAbsentTeacherId] = useState('')
  const [absentDate, setAbsentDate] = useState(new Date().toISOString().split('T')[0])
  const [absentReason, setAbsentReason] = useState('')
  const [teacherPeriods, setTeacherPeriods] = useState([])
  const [selectedPeriods, setSelectedPeriods] = useState([])
  const [periodSubstitutes, setPeriodSubstitutes] = useState({})
  const [loadingPeriods, setLoadingPeriods] = useState(false)
  const [creatingBulk, setCreatingBulk] = useState(false)

  // Queries
  const { data: substitutionsData, isLoading: subsLoading } = useQuery({
    queryKey: ['substitutions', selectedDate, statusFilter, user?._id, isTeacher],
    queryFn: () => timetableService.getSubstitutions({
      date: selectedDate,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      teacherId: isTeacher ? user._id : undefined
    })
  })
  const substitutions = substitutionsData?.data || substitutionsData || []

  const { data: teachersData } = useQuery({
    queryKey: ['teachers'],
    queryFn: async () => { const r = await api.get('/teachers'); return r.data?.data || r.data || [] },
    enabled: isAdmin
  })
  const teachers = teachersData || []

  // Stats
  const stats = useMemo(() => {
    const all = substitutionsData?.data || substitutionsData || []
    return {
      pending: all.filter(s => s.status === 'pending').length,
      assigned: all.filter(s => s.status === 'assigned').length,
      completed: all.filter(s => s.status === 'completed').length,
      total: all.length
    }
  }, [substitutionsData])

  // Mutations
  const updateSubMutation = useMutation({
    mutationFn: ({ id, data }) => timetableService.updateSubstitution(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['substitutions'])
      setShowAssignDropdown(null)
      toast.success('Substitution updated')
    },
    onError: (err) => toast.error(err?.message || 'Failed to update substitution')
  })

  const cancelSubMutation = useMutation({
    mutationFn: (id) => timetableService.cancelSubstitution(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['substitutions'])
      toast.success('Substitution cancelled')
    },
    onError: (err) => toast.error(err?.message || 'Failed to cancel')
  })

  // Fetch teacher periods for a given date
  const fetchTeacherPeriods = async (teacherId, date) => {
    try {
      setLoadingPeriods(true)
      const response = await timetableService.getTeacherSchedule(teacherId, {
        date,
        weekStart: date
      })
      const entries = response?.data?.entries || response?.entries || []
      setTeacherPeriods(entries)
      setSelectedPeriods(entries.map(e => e._id || e.slotNumber))
      // For each entry, fetch substitute suggestions in parallel
      const entriesToFetch = entries.slice(0, 10)
      const suggestionsResults = await Promise.allSettled(
        entriesToFetch.map(entry =>
          timetableService.getSubstitutionSuggestions(entry._id, { date })
        )
      )
      const suggestionsMap = {}
      entriesToFetch.forEach((entry, i) => {
        const result = suggestionsResults[i]
        const key = entry._id || entry.slotNumber
        suggestionsMap[key] = result.status === 'fulfilled'
          ? (result.value?.data || result.value || [])
          : []
      })
      setPeriodSubstitutes(suggestionsMap)
    } catch (err) {
      toast.error('Failed to load teacher schedule')
      setTeacherPeriods([])
    } finally {
      setLoadingPeriods(false)
    }
  }

  const handleAbsentTeacherChange = (teacherId) => {
    setAbsentTeacherId(teacherId)
    setTeacherPeriods([])
    setSelectedPeriods([])
    setPeriodSubstitutes({})
    if (teacherId && absentDate) {
      fetchTeacherPeriods(teacherId, absentDate)
    }
  }

  const handleAbsentDateChange = (date) => {
    setAbsentDate(date)
    setTeacherPeriods([])
    setSelectedPeriods([])
    setPeriodSubstitutes({})
    if (absentTeacherId && date) {
      fetchTeacherPeriods(absentTeacherId, date)
    }
  }

  const handleCreateBulkSubstitutions = async () => {
    if (selectedPeriods.length === 0) return toast.error('Select at least one period')
    try {
      setCreatingBulk(true)
      const subs = selectedPeriods.map(periodKey => {
        const entry = teacherPeriods.find(e => (e._id || e.slotNumber) === periodKey)
        const suggestions = periodSubstitutes[periodKey] || []
        // Use the first selected substitute or leave unassigned
        const assignedSub = entry?._assignedSubstitute
        return {
          date: absentDate,
          entryId: entry?._id,
          absentTeacherId: absentTeacherId,
          substituteTeacherId: assignedSub || undefined,
          reason: absentReason,
          slotNumber: entry?.slotNumber,
          classId: entry?.classId || entry?.class?._id,
          sectionId: entry?.sectionId || entry?.section?._id,
          subjectId: entry?.subjectId || entry?.subject?._id
        }
      })
      await timetableService.bulkCreateSubstitutions({ substitutions: subs })
      queryClient.invalidateQueries(['substitutions'])
      setShowAbsentModal(false)
      resetAbsentModal()
      toast.success(`${subs.length} substitution(s) created`)
    } catch (err) {
      toast.error(err?.message || 'Failed to create substitutions')
    } finally {
      setCreatingBulk(false)
    }
  }

  const handleTeacherReport = async () => {
    if (!absentDate) return toast.error('Select a date')
    try {
      setCreatingBulk(true)
      await timetableService.bulkCreateSubstitutions({
        substitutions: [{
          date: absentDate,
          absentTeacherId: user._id,
          reason: absentReason
        }]
      })
      queryClient.invalidateQueries(['substitutions'])
      setShowReportModal(false)
      setAbsentDate(new Date().toISOString().split('T')[0])
      setAbsentReason('')
      toast.success('Absence reported. Admin will assign substitutes.')
    } catch (err) {
      toast.error(err?.message || 'Failed to report absence')
    } finally {
      setCreatingBulk(false)
    }
  }

  const resetAbsentModal = () => {
    setAbsentTeacherId('')
    setAbsentDate(new Date().toISOString().split('T')[0])
    setAbsentReason('')
    setTeacherPeriods([])
    setSelectedPeriods([])
    setPeriodSubstitutes({})
  }

  const handleQuickAssign = (subId, teacherId) => {
    updateSubMutation.mutate({
      id: subId,
      data: { substituteTeacherId: teacherId, status: 'assigned' }
    })
  }

  // Assign substitute to a period in bulk modal
  const assignSubToPeriod = (periodKey, teacherId) => {
    setTeacherPeriods(prev => prev.map(p => {
      if ((p._id || p.slotNumber) === periodKey) {
        return { ...p, _assignedSubstitute: teacherId }
      }
      return p
    }))
  }

  const statusTabs = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'assigned', label: 'Assigned' },
    { key: 'completed', label: 'Completed' }
  ]

  const inputClass = 'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 focus:outline-none'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-primary-600" />
            Substitutions
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">
            {isAdmin ? 'Manage substitute assignments' : 'View your substitution duties'}
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <button
              onClick={() => { resetAbsentModal(); setShowAbsentModal(true) }}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
            >
              <UserMinus className="w-4 h-4" /> Mark Teacher Absent
            </button>
          )}
          {isTeacher && (
            <button
              onClick={() => { setAbsentDate(new Date().toISOString().split('T')[0]); setAbsentReason(''); setShowReportModal(true) }}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
            >
              <UserMinus className="w-4 h-4" /> Report Absence
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-1">
            {statusTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === tab.key
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-[#3A3A3C]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] p-4">
          <div className="flex items-center justify-between mb-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.pending}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase mt-0.5">Pending</p>
        </div>
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] p-4">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.assigned}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase mt-0.5">Assigned</p>
        </div>
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] p-4">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-5 h-5 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.completed}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase mt-0.5">Completed</p>
        </div>
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] p-4">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase mt-0.5">Total</p>
        </div>
      </div>

      {/* Teacher: My Substitution Duties */}
      {isTeacher && (
        <div className="bg-primary-50 dark:bg-primary-900/10 rounded-xl border border-primary-100 dark:border-primary-800/20 p-4">
          <h3 className="text-sm font-semibold text-primary-700 dark:text-primary-400 uppercase mb-2">My Substitution Duties</h3>
          {substitutions.filter(s => s.substituteTeacher?._id === user._id || s.substituteTeacherId === user._id).length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No substitution duties assigned to you for this date.</p>
          ) : (
            <div className="space-y-2">
              {substitutions
                .filter(s => s.substituteTeacher?._id === user._id || s.substituteTeacherId === user._id)
                .map(sub => (
                  <div key={sub._id} className="flex items-center gap-3 p-3 bg-white dark:bg-[#1C1C1E] rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {sub.class?.name || sub.className || 'N/A'} - Period {sub.slotNumber || '?'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {sub.subject?.name || sub.subjectName || ''} | Replacing: {sub.absentTeacher?.name || sub.absentTeacherName || 'N/A'}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_CONFIG[sub.status]?.bg || STATUS_CONFIG.pending.bg}`}>
                      {STATUS_CONFIG[sub.status]?.label || sub.status}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Substitutions Table */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] overflow-hidden">
        {subsLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg" />
            ))}
          </div>
        ) : substitutions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <RefreshCw className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-gray-500 dark:text-gray-400 mb-1">No substitutions found</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {statusFilter !== 'all' ? 'Try a different filter.' : 'No substitutions for this date.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-[#2C2C2E]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Period</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Class</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:table-cell">Subject</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Absent</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Substitute</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  {isAdmin && (
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#38383A]">
                {substitutions.map(sub => (
                  <tr key={sub._id} className="hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {sub.date ? new Date(sub.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                      P{sub.slotNumber || '?'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {sub.class?.name || sub.className || '-'}
                      {(sub.section?.name || sub.sectionName) && ` - ${sub.section?.name || sub.sectionName}`}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 hidden sm:table-cell">
                      {sub.subject?.name || sub.subjectName || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {sub.absentTeacher?.name || sub.absentTeacherName || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm relative">
                      {sub.substituteTeacher?.name || sub.substituteTeacherName ? (
                        <span className="text-gray-700 dark:text-gray-300">
                          {sub.substituteTeacher?.name || sub.substituteTeacherName}
                        </span>
                      ) : isAdmin ? (
                        <div className="relative">
                          <button
                            onClick={() => setShowAssignDropdown(showAssignDropdown === sub._id ? null : sub._id)}
                            className="flex items-center gap-1 px-2 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded text-xs font-medium hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                          >
                            Assign <ChevronDown className="w-3 h-3" />
                          </button>
                          {showAssignDropdown === sub._id && (
                            <div className="absolute top-full left-0 mt-1 z-30 bg-white dark:bg-[#2C2C2E] rounded-lg shadow-lg border border-gray-200 dark:border-[#38383A] w-48 max-h-48 overflow-y-auto">
                              {teachers.map(t => (
                                <button
                                  key={t._id}
                                  onClick={() => handleQuickAssign(sub._id, t._id)}
                                  className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#3A3A3C] transition-colors"
                                >
                                  {t.name || `${t.firstName || ''} ${t.lastName || ''}`.trim()}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 italic text-xs">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_CONFIG[sub.status]?.bg || STATUS_CONFIG.pending.bg}`}>
                        {STATUS_CONFIG[sub.status]?.label || sub.status}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {sub.status !== 'cancelled' && sub.status !== 'completed' && (
                            <button
                              onClick={() => { if (confirm('Cancel this substitution?')) cancelSubMutation.mutate(sub._id) }}
                              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 transition-colors"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mark Teacher Absent Modal */}
      {showAbsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAbsentModal(false)} />
          <div className="relative bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-[#38383A]">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Mark Teacher Absent</h3>
              <button onClick={() => setShowAbsentModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2C2C2E] text-gray-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Step 1: Teacher & Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Teacher *</label>
                  <select value={absentTeacherId} onChange={(e) => handleAbsentTeacherChange(e.target.value)} className={inputClass}>
                    <option value="">Select Teacher</option>
                    {teachers.map(t => (
                      <option key={t._id} value={t._id}>{t.name || `${t.firstName || ''} ${t.lastName || ''}`.trim()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date *</label>
                  <input type="date" value={absentDate} onChange={(e) => handleAbsentDateChange(e.target.value)} className={inputClass} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
                <input type="text" value={absentReason} onChange={(e) => setAbsentReason(e.target.value)} className={inputClass} placeholder="e.g. Sick leave" />
              </div>

              {/* Step 2: Periods */}
              {absentTeacherId && absentDate && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Periods to Cover
                  </label>
                  {loadingPeriods ? (
                    <div className="flex items-center gap-2 py-4 justify-center text-sm text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading schedule...
                    </div>
                  ) : teacherPeriods.length === 0 ? (
                    <p className="text-sm text-gray-400 dark:text-gray-500 py-3 text-center">No periods found for this teacher on this date.</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {teacherPeriods.map(period => {
                        const key = period._id || period.slotNumber
                        const isSelected = selectedPeriods.includes(key)
                        const suggestions = periodSubstitutes[key] || []
                        return (
                          <div key={key} className={`p-3 rounded-xl border transition-colors ${
                            isSelected
                              ? 'border-primary-200 dark:border-primary-700 bg-primary-50/50 dark:bg-primary-900/10'
                              : 'border-gray-100 dark:border-[#38383A] bg-gray-50 dark:bg-[#2C2C2E]'
                          }`}>
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  setSelectedPeriods(prev =>
                                    e.target.checked ? [...prev, key] : prev.filter(k => k !== key)
                                  )
                                }}
                                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  Period {period.slotNumber} - {period.subject?.name || period.subjectName || 'N/A'}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {period.class?.name || period.className || ''} {period.section?.name || period.sectionName || ''}
                                </p>
                              </div>
                              {isSelected && (
                                <select
                                  value={period._assignedSubstitute || ''}
                                  onChange={(e) => assignSubToPeriod(key, e.target.value)}
                                  className="px-2 py-1 rounded-lg border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-xs text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 focus:outline-none max-w-[150px]"
                                >
                                  <option value="">Auto-assign</option>
                                  {suggestions.length > 0 && (
                                    <optgroup label="Suggested">
                                      {suggestions.map(s => (
                                        <option key={s._id || s.teacherId} value={s._id || s.teacherId}>
                                          {s.name || s.teacherName || 'Unknown'}
                                        </option>
                                      ))}
                                    </optgroup>
                                  )}
                                  <optgroup label="All Teachers">
                                    {teachers.map(t => (
                                      <option key={t._id} value={t._id}>
                                        {t.name || `${t.firstName || ''} ${t.lastName || ''}`.trim()}
                                      </option>
                                    ))}
                                  </optgroup>
                                </select>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowAbsentModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2C2C2E] rounded-lg transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleCreateBulkSubstitutions}
                  disabled={creatingBulk || selectedPeriods.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {creatingBulk ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {creatingBulk ? 'Creating...' : `Create ${selectedPeriods.length} Substitution(s)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Teacher Report Absence Modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowReportModal(false)} />
          <div className="relative bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-[#38383A]">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Report Absence</h3>
              <button onClick={() => setShowReportModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2C2C2E] text-gray-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date *</label>
                <input type="date" value={absentDate} onChange={(e) => setAbsentDate(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
                <textarea value={absentReason} onChange={(e) => setAbsentReason(e.target.value)} className={inputClass} rows={3} placeholder="Reason for absence..." />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowReportModal(false)} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#2C2C2E] rounded-lg transition-colors">Cancel</button>
                <button
                  onClick={handleTeacherReport}
                  disabled={creatingBulk || !absentDate}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {creatingBulk ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {creatingBulk ? 'Submitting...' : 'Report Absence'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Substitutions
