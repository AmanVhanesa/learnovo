import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Calendar, Clock, ChevronLeft, ChevronRight,
  BookOpen, User, MapPin, Timer, ArrowRight, Eye
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { timetableService } from '../../services/timetableService'
import { attendanceService } from '../../services/attendanceService'
import TimetableGrid from '../../components/timetable/TimetableGrid'
import ViewSwitcher from '../../components/timetable/ViewSwitcher'
import TimetableExportButton from '../../components/timetable/TimetableExportButton'
import api from '../../services/authService'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAYS_LOWER = DAYS.map(d => d.toLowerCase())
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getWeekDates(offset = 0) {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7)
  const dates = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    dates.push(d)
  }
  return dates
}

function formatWeekRange(dates) {
  if (!dates || dates.length < 2) return ''
  const start = dates[0]
  const end = dates[5] || dates[dates.length - 1]
  const opts = { month: 'short', day: 'numeric' }
  return `${start.toLocaleDateString('en-IN', opts)} - ${end.toLocaleDateString('en-IN', opts)}, ${end.getFullYear()}`
}

function getTodayIndex() {
  const day = new Date().getDay()
  return day === 0 ? -1 : day - 1
}

const ScheduleLoadingSkeleton = () => (
  <div className="space-y-4">
    <div className="h-20 animate-pulse bg-gray-200 dark:bg-gray-700 rounded-xl" />
    <div className="h-96 animate-pulse bg-gray-200 dark:bg-gray-700 rounded-xl" />
  </div>
)

const TimetableSchedule = () => {
  const { user } = useAuth()
  const role = user?.role
  const isAdmin = role === 'admin'
  const isTeacher = role === 'teacher'
  const isStudent = role === 'student'
  const isParent = role === 'parent'

  // State
  const [weekOffset, setWeekOffset] = useState(0)
  const [activeView, setActiveView] = useState('class')
  const [teacherView, setTeacherView] = useState('my') // 'my' | 'class' — for teacher only
  const [selectedClassId, setSelectedClassId] = useState(user?.classId || '')
  const [selectedSectionId, setSelectedSectionId] = useState(user?.sectionId || '')
  const [selectedTeacherId, setSelectedTeacherId] = useState(isTeacher ? user?._id : '')
  const [selectedRoomId, setSelectedRoomId] = useState('')
  const [selectedChildIndex, setSelectedChildIndex] = useState(0)
  const [mobileDay, setMobileDay] = useState(getTodayIndex() >= 0 ? getTodayIndex() : 0)
  const [exportLoading, setExportLoading] = useState(false)

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset])
  const weekRangeLabel = useMemo(() => formatWeekRange(weekDates), [weekDates])
  const todayIndex = getTodayIndex()

  // For parents, get children list
  const children = isParent ? (user?.children || []) : []
  const activeChild = children[selectedChildIndex]
  const effectiveClassId = isParent ? activeChild?.classId : selectedClassId
  const effectiveSectionId = isParent ? activeChild?.sectionId : selectedSectionId

  // Dropdown data for admin
  const { data: classesData } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const res = await api.get('/classes')
      const data = res.data?.data || res.data
      return Array.isArray(data) ? data : []
    },
    enabled: isAdmin
  })

  const { data: sectionsData } = useQuery({
    queryKey: ['sections', selectedClassId],
    queryFn: async () => {
      const res = await api.get(`/classes/${selectedClassId}`)
      const classData = res.data?.data || res.data || {}
      const sections = classData.sections || classData.data?.sections
      return Array.isArray(sections) ? sections : []
    },
    enabled: isAdmin && !!selectedClassId
  })

  const { data: teachersData } = useQuery({
    queryKey: ['teachers'],
    queryFn: async () => {
      const res = await api.get('/teachers')
      const data = res.data?.data || res.data
      return Array.isArray(data) ? data : []
    },
    enabled: isAdmin
  })

  const { data: roomsData } = useQuery({
    queryKey: ['timetable-rooms'],
    queryFn: async () => {
      const res = await timetableService.getRooms()
      const data = res?.data || res
      return Array.isArray(data) ? data : []
    },
    enabled: isAdmin && activeView === 'room'
  })

  // Teacher: fetch assigned classes for class view
  const { data: teacherClassesData } = useQuery({
    queryKey: ['teacher-timetable-classes'],
    queryFn: async () => {
      const res = await attendanceService.getTeacherClasses()
      return res?.data || []
    },
    enabled: isTeacher
  })

  // Build query params based on role and active view
  const scheduleParams = useMemo(() => {
    const params = {
      weekStart: weekDates[0]?.toISOString().split('T')[0]
    }
    if (isStudent || (isParent && effectiveClassId)) {
      params.classId = effectiveClassId
      params.sectionId = effectiveSectionId
    }
    if (isTeacher) {
      if (teacherView === 'class' && selectedClassId) {
        params.classId = selectedClassId
      } else {
        params.teacherId = user?._id
      }
    }
    if (isAdmin) {
      if (activeView === 'class' && selectedClassId) {
        params.classId = selectedClassId
        if (selectedSectionId) params.sectionId = selectedSectionId
      } else if (activeView === 'teacher' && selectedTeacherId) {
        params.teacherId = selectedTeacherId
      } else if (activeView === 'room' && selectedRoomId) {
        params.roomId = selectedRoomId
      }
    }
    return params
  }, [weekDates, role, activeView, teacherView, selectedClassId, selectedSectionId, selectedTeacherId, selectedRoomId, effectiveClassId, effectiveSectionId])

  // Determine which fetch function to use
  const fetchScheduleFn = useMemo(() => {
    if (isAdmin && activeView === 'teacher' && selectedTeacherId) {
      return () => timetableService.getTeacherSchedule(selectedTeacherId, { weekStart: scheduleParams.weekStart })
    }
    if (isAdmin && activeView === 'room' && selectedRoomId) {
      return () => timetableService.getRoomSchedule(selectedRoomId, { weekStart: scheduleParams.weekStart })
    }
    if ((isAdmin && activeView === 'class' && selectedClassId) || isStudent || isParent) {
      const cid = isAdmin ? selectedClassId : effectiveClassId
      if (cid) {
        return () => timetableService.getClassSchedule(cid, {
          weekStart: scheduleParams.weekStart,
          sectionId: scheduleParams.sectionId
        })
      }
    }
    if (isTeacher) {
      if (teacherView === 'class' && selectedClassId) {
        return () => timetableService.getClassSchedule(selectedClassId, { weekStart: scheduleParams.weekStart })
      }
      return () => timetableService.getTeacherSchedule(user?._id, { weekStart: scheduleParams.weekStart })
    }
    return () => timetableService.getWeekSchedule(scheduleParams)
  }, [scheduleParams, role, activeView, teacherView, isAdmin, isTeacher, isStudent, isParent, selectedClassId, selectedTeacherId, selectedRoomId, effectiveClassId, user?._id])

  const shouldFetch = useMemo(() => {
    if (isStudent) return !!effectiveClassId
    if (isParent) return !!effectiveClassId
    if (isTeacher) return teacherView === 'my' || !!selectedClassId
    if (isAdmin) {
      if (activeView === 'class') return !!selectedClassId
      if (activeView === 'teacher') return !!selectedTeacherId
      if (activeView === 'room') return !!selectedRoomId
    }
    return false
  }, [role, activeView, teacherView, selectedClassId, selectedTeacherId, selectedRoomId, effectiveClassId])

  const { data: weekData, isLoading: weekLoading, error: weekError } = useQuery({
    queryKey: ['week-schedule', scheduleParams, activeView],
    queryFn: fetchScheduleFn,
    enabled: shouldFetch
  })

  // Show error toast when week schedule fails
  React.useEffect(() => {
    if (weekError) toast.error('Failed to load timetable')
  }, [weekError])

  const { data: todayData, isLoading: todayLoading } = useQuery({
    queryKey: ['today-schedule', effectiveClassId || selectedClassId || user?._id],
    queryFn: () => timetableService.getTodaySchedule({
      classId: effectiveClassId || selectedClassId,
      sectionId: effectiveSectionId || selectedSectionId,
      teacherId: isTeacher ? user?._id : selectedTeacherId
    }),
    enabled: shouldFetch
  })

  // Extract data — backend returns { data: { days: [{ dayOfWeek, entries, timings }] } }
  // Flatten the nested per-day structure into flat arrays the grid expects.
  const { entries, timings, workingDays, substitutions } = useMemo(() => {
    const raw = weekData?.data || weekData || {}
    const days = Array.isArray(raw.days) ? raw.days : []

    // If backend already returns flat entries (future-proof), use them directly
    if (Array.isArray(raw.entries)) {
      return {
        entries: raw.entries,
        timings: Array.isArray(raw.timings) ? raw.timings : [],
        workingDays: Array.isArray(raw.workingDays) ? raw.workingDays : DAYS.slice(0, 6),
        substitutions: Array.isArray(raw.substitutions) ? raw.substitutions : [],
      }
    }

    // Flatten per-day entries into a single array, normalize field names for TimetableGrid
    const allEntries = []
    const allSubstitutions = []
    let allTimings = []
    const wDays = []

    for (const day of days) {
      if (day.isOff) continue
      if (day.dayOfWeek) wDays.push(day.dayOfWeek)

      // Use the first day's timings (they're the same for all days)
      if (allTimings.length === 0 && Array.isArray(day.timings)) {
        allTimings = day.timings
      }

      if (Array.isArray(day.entries)) {
        for (const entry of day.entries) {
          allEntries.push({
            ...entry,
            dayOfWeek: entry.dayOfWeek || day.dayOfWeek,
            // Normalize populated references for TimetableGrid
            subject: entry.subjectId || entry.subject,
            teacher: entry.teacherId && typeof entry.teacherId === 'object' ? entry.teacherId : entry.teacher,
            room: entry.roomId && typeof entry.roomId === 'object' ? entry.roomId : entry.room,
            timingSlot: entry.timingSlotId || entry.timingSlot,
          })
          // Collect substitutions
          if (entry.isSubstituted && entry.substitution) {
            allSubstitutions.push({
              ...entry.substitution,
              originalEntry: entry._id,
              substituteTeacherName: entry.substitution?.substituteTeacher?.name,
              substituteSubjectName: entry.substitution?.substituteSubject?.name,
            })
          }
        }
      }
    }

    return {
      entries: allEntries,
      timings: allTimings,
      workingDays: wDays.length > 0 ? wDays : DAYS.slice(0, 6),
      substitutions: allSubstitutions,
    }
  }, [weekData])

  // Today's data — single day format: { data: { entries, timings, ... } }
  const { todayEntries, todayTimings } = useMemo(() => {
    const raw = todayData?.data || todayData || {}
    const rawEntries = Array.isArray(raw.entries) ? raw.entries : []
    const rawTimings = Array.isArray(raw.timings) ? raw.timings : []
    return {
      todayEntries: rawEntries.map(e => ({
        ...e,
        subject: e.subjectId || e.subject,
        teacher: e.teacherId && typeof e.teacherId === 'object' ? e.teacherId : e.teacher,
        room: e.roomId && typeof e.roomId === 'object' ? e.roomId : e.room,
        timingSlot: e.timingSlotId || e.timingSlot,
        slotNumber: e.timingSlotId?.slotNumber || e.timingSlot?.slotNumber || e.slotNumber,
        timingId: e.timingSlotId?._id || e.timingSlot?._id || e.timingId,
      })),
      todayTimings: rawTimings,
    }
  }, [todayData])

  // Current period logic
  const currentPeriod = useMemo(() => {
    if (todayIndex < 0) return null
    const now = new Date()
    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    for (const timing of todayTimings) {
      if (timing.type === 'break' || timing.type === 'lunch') continue
      const [sh, sm] = (timing.startTime || '').split(':').map(Number)
      const [eh, em] = (timing.endTime || '').split(':').map(Number)
      if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) continue
      const start = sh * 60 + sm
      const end = eh * 60 + em
      if (nowMinutes >= start && nowMinutes < end) {
        const entry = todayEntries.find(e => e.slotNumber === timing.slotNumber || e.timingId === timing._id)
        const minutesLeft = end - nowMinutes
        return { timing, entry, minutesLeft }
      }
    }
    return null
  }, [todayTimings, todayEntries, todayIndex])

  const nextPeriod = useMemo(() => {
    if (todayIndex < 0) return null
    const now = new Date()
    const nowMinutes = now.getHours() * 60 + now.getMinutes()
    const upcoming = todayTimings
      .filter(t => t.type !== 'break' && t.type !== 'lunch')
      .filter(t => {
        const [sh, sm] = (t.startTime || '').split(':').map(Number)
        return !isNaN(sh) && (sh * 60 + sm) > nowMinutes
      })
      .sort((a, b) => {
        const [ah] = (a.startTime || '').split(':').map(Number)
        const [bh] = (b.startTime || '').split(':').map(Number)
        return ah - bh
      })
    if (upcoming.length === 0) return null
    const timing = upcoming[0]
    const entry = todayEntries.find(e => e.slotNumber === timing.slotNumber || e.timingId === timing._id)
    return { timing, entry }
  }, [todayTimings, todayEntries, todayIndex])

  // Export handlers
  const handleExportPDF = async () => {
    let url = null
    try {
      setExportLoading(true)
      const blob = await timetableService.exportPDF(scheduleParams)
      url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'timetable.pdf'
      a.click()
      toast.success('PDF exported successfully')
    } catch {
      toast.error('Failed to export PDF')
    } finally {
      if (url) window.URL.revokeObjectURL(url)
      setExportLoading(false)
    }
  }

  const handleExportExcel = async () => {
    let url = null
    try {
      setExportLoading(true)
      const blob = await timetableService.exportExcel(scheduleParams)
      url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'timetable.xlsx'
      a.click()
      toast.success('Excel exported successfully')
    } catch {
      toast.error('Failed to export Excel')
    } finally {
      if (url) window.URL.revokeObjectURL(url)
      setExportLoading(false)
    }
  }

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16">
      <Calendar className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
      <h3 className="text-lg font-semibold text-gray-500 dark:text-gray-400 mb-2">No Timetable Found</h3>
      <p className="text-sm text-gray-400 dark:text-gray-500 text-center max-w-sm">
        {isAdmin
          ? 'Select a class, teacher, or room to view their schedule. Make sure a timetable has been published.'
          : 'No published timetable is available for your class yet. Please check back later.'}
      </p>
    </div>
  )

  // Filter for mobile day view
  const mobileDayEntries = useMemo(() => {
    const dayName = DAYS_LOWER[mobileDay]
    return entries.filter(e => e.dayOfWeek?.toLowerCase() === dayName || e.day?.toLowerCase() === dayName)
  }, [entries, mobileDay])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-primary-600" />
            Timetable
          </h1>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">
            {isStudent && user?.class ? `Class ${user.class}${user.section ? ` — Section ${user.section}` : ''} · Weekly Schedule` : 'Weekly Schedule'}
          </p>
        </div>
        <TimetableExportButton
          onExportPDF={handleExportPDF}
          onExportExcel={handleExportExcel}
          loading={exportLoading}
        />
      </div>

      {/* Admin: View Switcher */}
      {isAdmin && (
        <ViewSwitcher activeView={activeView} onChange={setActiveView} />
      )}

      {/* Teacher: My Schedule / Class View toggle */}
      {isTeacher && (
        <div className="flex gap-2">
          <button
            onClick={() => { setTeacherView('my'); setSelectedClassId('') }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              teacherView === 'my'
                ? 'bg-primary-600 text-white dark:bg-[#3EC4B1] dark:text-black'
                : 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#3A3A3C]'
            }`}
          >
            My Schedule
          </button>
          <button
            onClick={() => setTeacherView('class')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              teacherView === 'class'
                ? 'bg-primary-600 text-white dark:bg-[#3EC4B1] dark:text-black'
                : 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#3A3A3C]'
            }`}
          >
            Class Timetable
          </button>
        </div>
      )}

      {/* Filters Row */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Admin: Class View Filters */}
          {isAdmin && activeView === 'class' && (
            <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-3">
              <select
                value={selectedClassId}
                onChange={(e) => { setSelectedClassId(e.target.value); setSelectedSectionId('') }}
                className="w-full sm:w-auto min-w-[160px] px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 focus:outline-none"
              >
                <option value="">Select Class</option>
                {(classesData || []).map(cls => (
                  <option key={cls._id} value={cls._id}>{cls.name || cls.className}</option>
                ))}
              </select>
              <select
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                className="w-full sm:w-auto min-w-[160px] px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                disabled={!selectedClassId}
              >
                <option value="">All Sections</option>
                {(sectionsData || []).map(sec => (
                  <option key={sec._id} value={sec._id}>{sec.name || sec.sectionName}</option>
                ))}
              </select>
            </div>
          )}

          {/* Admin: Teacher View Filter */}
          {isAdmin && activeView === 'teacher' && (
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              className="w-full sm:w-auto min-w-[160px] px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 focus:outline-none"
            >
              <option value="">Select Teacher</option>
              {(teachersData || []).map(t => (
                <option key={t._id} value={t._id}>{t.name || `${t.firstName || ''} ${t.lastName || ''}`.trim()}</option>
              ))}
            </select>
          )}

          {/* Admin: Room View Filter */}
          {isAdmin && activeView === 'room' && (
            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              className="w-full sm:w-auto min-w-[160px] px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 focus:outline-none"
            >
              <option value="">Select Room</option>
              {(roomsData || []).map(r => (
                <option key={r._id} value={r._id}>{r.name} {r.building ? `(${r.building})` : ''}</option>
              ))}
            </select>
          )}

          {/* Teacher: Class View Filter */}
          {isTeacher && teacherView === 'class' && (
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full sm:w-auto min-w-[160px] px-3 py-2.5 rounded-xl border border-gray-200 dark:border-[#38383A] bg-white dark:bg-[#2C2C2E] text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 focus:outline-none"
            >
              <option value="">Select Class</option>
              {(teacherClassesData || []).map(cls => (
                <option key={cls._id} value={cls._id}>{cls.name || cls.grade}</option>
              ))}
            </select>
          )}

          {/* Parent: Child Tabs */}
          {isParent && children.length > 1 && (
            <div className="flex gap-2">
              {children.map((child, idx) => (
                <button
                  key={child._id || idx}
                  onClick={() => setSelectedChildIndex(idx)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedChildIndex === idx
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#3A3A3C]'
                  }`}
                >
                  {child.name || `Child ${idx + 1}`}
                </button>
              ))}
            </div>
          )}

          {/* Week Navigation */}
          <div className="flex items-center gap-2 sm:ml-auto">
            <button
              onClick={() => setWeekOffset(prev => prev - 1)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2C2C2E] text-gray-600 dark:text-gray-400 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-[#2C2C2E] rounded-lg hover:bg-gray-100 dark:hover:bg-[#3A3A3C] transition-colors"
            >
              {weekOffset === 0 ? 'This Week' : weekRangeLabel}
            </button>
            <button
              onClick={() => setWeekOffset(prev => prev + 1)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2C2C2E] text-gray-600 dark:text-gray-400 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Today's Schedule Card */}
      {weekOffset === 0 && todayIndex >= 0 && shouldFetch && (
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/20">
              <Clock className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
              Today's Schedule
            </h3>
            {currentPeriod && (
              <span className="ml-auto px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-xs font-medium rounded-full">
                Live
              </span>
            )}
          </div>

          {todayLoading ? (
            <div className="h-12 animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg" />
          ) : currentPeriod ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 flex items-center gap-3 p-3 bg-primary-50 dark:bg-primary-900/10 rounded-lg border border-primary-100 dark:border-primary-800/30">
                <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                  <BookOpen className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    Current: {currentPeriod.timing?.label || `Period ${currentPeriod.timing?.slotNumber}`}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {currentPeriod.entry?.subject?.name || currentPeriod.entry?.subjectName || 'Free Period'}
                    {currentPeriod.entry?.teacher?.name ? ` · ${currentPeriod.entry.teacher.name}` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-sm font-medium text-primary-600 dark:text-primary-400">
                    <Timer className="w-3.5 h-3.5" />
                    {currentPeriod.minutesLeft} min left
                  </div>
                </div>
              </div>
              {nextPeriod && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-[#2C2C2E] rounded-lg">
                  <ArrowRight className="w-4 h-4 text-gray-400 hidden sm:block" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 uppercase">Next</p>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                      {nextPeriod.entry?.subject?.name || nextPeriod.entry?.subjectName || 'Free Period'}
                      {nextPeriod.entry?.teacher?.name ? ` · ${nextPeriod.entry.teacher.name}` : ''}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : todayEntries.length > 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No active period right now. Classes may have ended for today.</p>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No schedule for today.</p>
          )}
        </div>
      )}

      {/* Main Grid */}
      {weekLoading ? (
        <ScheduleLoadingSkeleton />
      ) : !shouldFetch ? (
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] p-8">
          <div className="flex flex-col items-center justify-center py-8">
            <Eye className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isAdmin ? 'Select a filter above to view the timetable.'
                : isStudent && !effectiveClassId ? 'Your class assignment is not set up yet. Please contact your school administration.'
                : 'No timetable available. Please check back later.'}
            </p>
          </div>
        </div>
      ) : entries.length === 0 ? (
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] p-8">
          <EmptyState />
        </div>
      ) : (
        <>
          {/* Desktop Grid */}
          <div className="hidden md:block bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-100 dark:border-[#38383A] overflow-hidden">
            <TimetableGrid
              entries={entries}
              timings={timings}
              workingDays={workingDays}
              mode="view"
              onCellClick={() => {}}
              onEntryClick={() => {}}
              highlightToday={weekOffset === 0}
              substitutions={substitutions}
              loading={weekLoading}
            />
          </div>

          {/* Mobile Day Tabs */}
          <div className="md:hidden space-y-4">
            <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
              {workingDays.map((day) => {
                const dayIdx = DAYS_LOWER.indexOf(day.toLowerCase())
                if (dayIdx < 0) return null
                const isToday = dayIdx === todayIndex && weekOffset === 0
                return (
                  <button
                    key={day}
                    onClick={() => setMobileDay(dayIdx)}
                    className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                      mobileDay === dayIdx
                        ? 'bg-primary-600 text-white'
                        : isToday
                          ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                          : 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {DAY_SHORT[dayIdx]}
                    {isToday && mobileDay !== dayIdx && (
                      <span className="ml-1 w-1.5 h-1.5 inline-block rounded-full bg-primary-600 dark:bg-primary-400" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Mobile Day Entries */}
            <div className="space-y-2">
              {todayTimings.length > 0 ? todayTimings
                .sort((a, b) => (a.slotNumber || 0) - (b.slotNumber || 0))
                .map(timing => {
                  const dayName = DAYS_LOWER[mobileDay]
                  const entry = entries.find(e =>
                    (e.dayOfWeek?.toLowerCase() === dayName || e.day?.toLowerCase() === dayName) &&
                    (e.timingSlot?._id === timing._id || e.timingSlotId?._id === timing._id || e.slotNumber === timing.slotNumber || e.timingId === timing._id)
                  )
                  const isBreak = timing.type === 'break' || timing.type === 'lunch'

                  return (
                    <div
                      key={timing._id || timing.slotNumber}
                      className={`p-3 rounded-xl border ${
                        isBreak
                          ? 'bg-gray-50 dark:bg-[#2C2C2E] border-gray-100 dark:border-[#38383A]'
                          : 'bg-white dark:bg-[#1C1C1E] border-gray-100 dark:border-[#38383A]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-center min-w-[50px]">
                          <p className="text-xs font-medium text-gray-400 dark:text-gray-500">{timing.startTime}</p>
                          <p className="text-[10px] text-gray-300 dark:text-gray-600">{timing.endTime}</p>
                        </div>
                        <div className="w-px h-8 bg-gray-200 dark:bg-gray-700" />
                        {isBreak ? (
                          <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                            {timing.label || timing.type}
                          </p>
                        ) : entry ? (
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                              {entry.subject?.name || entry.subjectName || 'Unknown'}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {(entry.teacher?.name || entry.teacherName) && (
                                <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                  <User className="w-3 h-3" />
                                  {entry.teacher?.name || entry.teacherName}
                                </span>
                              )}
                              {(entry.room?.name || entry.roomName) && (
                                <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                                  <MapPin className="w-3 h-3" />
                                  {entry.room?.name || entry.roomName}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400 dark:text-gray-500">Free Period</p>
                        )}
                      </div>
                    </div>
                  )
                }) : mobileDayEntries.length > 0 ? mobileDayEntries.map((entry, idx) => (
                  <div key={entry._id || idx} className="p-3 rounded-xl bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-[#38383A]">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {entry.subject?.name || entry.subjectName || 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {entry.teacher?.name || entry.teacherName || ''}
                    </p>
                  </div>
                )) : (
                  <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
                    No classes on {DAYS[mobileDay]}
                  </div>
                )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default TimetableSchedule
