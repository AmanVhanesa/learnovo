import React, { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import TimeslotCard from './TimeslotCard'

const DAY_LABELS = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday'
}

const DAY_SHORT = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun'
}

function getCurrentDayKey() {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  return days[new Date().getDay()]
}

function formatTime(timeStr) {
  if (!timeStr) return ''
  // Handle HH:mm format
  const [h, m] = timeStr.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

const TimetableGrid = ({
  entries = [],
  timings = [],
  workingDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  mode = 'view',
  onCellClick,
  onEntryClick,
  highlightToday = true,
  substitutions = [],
  loading = false
}) => {
  const [mobileDay, setMobileDay] = useState(() => {
    const today = getCurrentDayKey()
    return workingDays.includes(today) ? workingDays.indexOf(today) : 0
  })

  const currentDay = getCurrentDayKey()

  // Build a lookup: { `${dayOfWeek}_${slotId}` => entry }
  const entryMap = useMemo(() => {
    const map = {}
    entries.forEach((entry) => {
      const day = entry.dayOfWeek?.toLowerCase()
      const slotId = entry.timingSlot?._id || entry.timingSlot || entry.slotId
      if (day && slotId) {
        const key = `${day}_${slotId}`
        if (!map[key]) map[key] = []
        map[key].push(entry)
      }
    })
    return map
  }, [entries])

  // Build substitution lookup by entry ID
  const subMap = useMemo(() => {
    const map = {}
    substitutions.forEach((sub) => {
      const entryId = sub.originalEntry?._id || sub.originalEntry
      if (entryId) map[entryId] = sub
    })
    return map
  }, [substitutions])

  const sortedTimings = useMemo(() => {
    return [...timings].sort((a, b) => (a.slotNumber || 0) - (b.slotNumber || 0))
  }, [timings])

  // Mobile day navigation
  const handlePrevDay = () => {
    setMobileDay((prev) => (prev > 0 ? prev - 1 : workingDays.length - 1))
  }
  const handleNextDay = () => {
    setMobileDay((prev) => (prev < workingDays.length - 1 ? prev + 1 : 0))
  }

  // Skeleton loading state
  if (loading) {
    return (
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-200 dark:border-[#38383A] overflow-hidden animate-pulse">
        <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-[#38383A]">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="bg-gray-50 dark:bg-[#2C2C2E] h-10" />
          ))}
        </div>
        {[...Array(6)].map((_, row) => (
          <div key={row} className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-[#38383A]">
            {[...Array(7)].map((_, col) => (
              <div key={col} className="bg-white dark:bg-[#1C1C1E] h-20 p-2">
                <div className="h-3 bg-gray-200 dark:bg-[#2C2C2E] rounded w-3/4 mb-1.5" />
                <div className="h-2.5 bg-gray-100 dark:bg-[#38383A] rounded w-1/2" />
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  const renderCell = (day, timing) => {
    const slotId = timing._id
    const key = `${day}_${slotId}`
    const cellEntries = entryMap[key] || []

    if (cellEntries.length === 0) {
      // Empty cell
      if (mode === 'edit') {
        return (
          <button
            type="button"
            onClick={() => onCellClick?.(day, timing)}
            className="w-full h-full min-h-[60px] flex items-center justify-center group/cell rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-colors"
          >
            <Plus className="w-4 h-4 text-gray-300 dark:text-[#636366] opacity-0 group-hover/cell:opacity-100 transition-opacity" />
          </button>
        )
      }
      return <div className="w-full h-full min-h-[60px]" />
    }

    return (
      <div className="space-y-1">
        {cellEntries.map((entry) => {
          const entryId = entry._id
          const sub = subMap[entryId]
          return (
            <TimeslotCard
              key={entryId}
              entry={entry}
              isSubstituted={!!sub}
              substituteInfo={sub ? {
                teacherName: sub.substituteTeacher?.name || sub.substituteTeacherName,
                subjectName: sub.substituteSubject?.name || sub.substituteSubjectName
              } : null}
              hasConflict={entry.hasConflict || false}
              isLocked={entry.isLocked || false}
              onClick={() => onEntryClick?.(entry)}
            />
          )
        })}
      </div>
    )
  }

  const renderBreakRow = (timing) => {
    const label = timing.label || (timing.type === 'lunch' ? 'Lunch Break' : 'Break')
    return (
      <tr key={timing._id}>
        {/* Time cell */}
        <td className="px-3 py-2 text-center bg-gray-50 dark:bg-[#2C2C2E] border-b border-gray-200 dark:border-[#38383A]">
          <p className="text-[11px] font-medium text-gray-500 dark:text-[#8E8E93]">
            {formatTime(timing.startTime)}
          </p>
        </td>
        {/* Break spans all day columns */}
        <td
          colSpan={workingDays.length}
          className="px-4 py-2.5 text-center bg-gray-100 dark:bg-[#2C2C2E] border-b border-gray-200 dark:border-[#38383A]"
        >
          <span className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide">
            {label}
          </span>
        </td>
      </tr>
    )
  }

  // ── Desktop grid ──────────────────────────────────────────
  const renderDesktop = () => (
    <div className="hidden md:block bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-200 dark:border-[#38383A] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="w-24 px-3 py-3 bg-gray-50 dark:bg-[#2C2C2E] text-left border-b border-r border-gray-200 dark:border-[#38383A]">
                <span className="text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">
                  Time
                </span>
              </th>
              {workingDays.map((day) => (
                <th
                  key={day}
                  className={`px-3 py-3 text-center border-b border-r last:border-r-0 border-gray-200 dark:border-[#38383A] ${
                    highlightToday && day === currentDay
                      ? 'bg-primary-50 dark:bg-primary-900/10'
                      : 'bg-gray-50 dark:bg-[#2C2C2E]'
                  }`}
                >
                  <span className="text-[11px] font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wider">
                    {DAY_LABELS[day] || day}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedTimings.map((timing) => {
              const isBreak = timing.type === 'break' || timing.type === 'lunch'
              if (isBreak) return renderBreakRow(timing)

              return (
                <tr key={timing._id}>
                  {/* Time column */}
                  <td className="w-24 px-3 py-2 bg-gray-50 dark:bg-[#2C2C2E] border-b border-r border-gray-200 dark:border-[#38383A] align-top">
                    <p className="text-[12px] font-semibold text-gray-700 dark:text-white whitespace-nowrap">
                      {formatTime(timing.startTime)}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-[#636366] mt-0.5">
                      {timing.label || `Period ${timing.slotNumber}`}
                    </p>
                  </td>

                  {/* Day columns */}
                  {workingDays.map((day) => (
                    <td
                      key={day}
                      className={`px-1.5 py-1.5 border-b border-r last:border-r-0 border-gray-200 dark:border-[#38383A] align-top ${
                        highlightToday && day === currentDay
                          ? 'bg-primary-50/50 dark:bg-primary-900/5'
                          : 'bg-white dark:bg-[#1C1C1E]'
                      }`}
                    >
                      {renderCell(day, timing)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )

  // ── Mobile single-day view ────────────────────────────────
  const renderMobile = () => {
    const activeDayKey = workingDays[mobileDay]

    return (
      <div className="md:hidden bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass border border-gray-200 dark:border-[#38383A] overflow-hidden">
        {/* Day tabs / navigation */}
        <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50 dark:bg-[#2C2C2E] border-b border-gray-200 dark:border-[#38383A]">
          <button
            type="button"
            onClick={handlePrevDay}
            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-[#38383A] transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-500 dark:text-[#8E8E93]" />
          </button>

          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
            {workingDays.map((day, idx) => (
              <button
                key={day}
                type="button"
                onClick={() => setMobileDay(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  idx === mobileDay
                    ? 'bg-white dark:bg-[#1C1C1E] text-primary-600 dark:text-primary-400 shadow-sm'
                    : highlightToday && day === currentDay
                      ? 'text-primary-500 dark:text-primary-400'
                      : 'text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white'
                }`}
              >
                {DAY_SHORT[day] || day.slice(0, 3)}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleNextDay}
            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-[#38383A] transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-gray-500 dark:text-[#8E8E93]" />
          </button>
        </div>

        {/* Period list for active day */}
        <div className="divide-y divide-gray-100 dark:divide-[#38383A]">
          {sortedTimings.map((timing) => {
            const isBreak = timing.type === 'break' || timing.type === 'lunch'
            const label = timing.label || (timing.type === 'lunch' ? 'Lunch Break' : timing.type === 'break' ? 'Break' : `Period ${timing.slotNumber}`)

            if (isBreak) {
              return (
                <div
                  key={timing._id}
                  className="px-4 py-3 bg-gray-50 dark:bg-[#2C2C2E] text-center"
                >
                  <span className="text-xs font-medium text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide">
                    {formatTime(timing.startTime)} &mdash; {label}
                  </span>
                </div>
              )
            }

            return (
              <div key={timing._id} className="flex items-start gap-3 px-4 py-3">
                {/* Time label */}
                <div className="w-16 flex-shrink-0 pt-0.5">
                  <p className="text-xs font-semibold text-gray-700 dark:text-white">
                    {formatTime(timing.startTime)}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-[#636366]">{label}</p>
                </div>

                {/* Entry */}
                <div className="flex-1 min-w-0">
                  {renderCell(activeDayKey, timing)}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <>
      {renderDesktop()}
      {renderMobile()}
    </>
  )
}

export default TimetableGrid
