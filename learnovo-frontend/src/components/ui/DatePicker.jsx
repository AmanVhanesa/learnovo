import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const DatePicker = ({ value, onChange, max, min, placeholder = 'Select date', className = '', disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => {
    if (value) return new Date(value + 'T00:00:00')
    return new Date()
  })
  const containerRef = useRef(null)
  const dropdownRef = useRef(null)

  const selectedDate = value ? new Date(value + 'T00:00:00') : null
  const maxDate = max ? new Date(max + 'T00:00:00') : null
  const minDate = min ? new Date(min + 'T00:00:00') : null

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handler)
      document.addEventListener('touchstart', handler)
    }
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [isOpen])

  // Position dropdown above if not enough space below
  useEffect(() => {
    if (isOpen && dropdownRef.current && containerRef.current) {
      const trigger = containerRef.current.getBoundingClientRect()
      const dropdown = dropdownRef.current
      const spaceBelow = window.innerHeight - trigger.bottom
      const spaceAbove = trigger.top

      if (spaceBelow < 340 && spaceAbove > spaceBelow) {
        dropdown.style.bottom = '100%'
        dropdown.style.top = 'auto'
        dropdown.style.marginBottom = '4px'
        dropdown.style.marginTop = '0'
      } else {
        dropdown.style.top = '100%'
        dropdown.style.bottom = 'auto'
        dropdown.style.marginTop = '4px'
        dropdown.style.marginBottom = '0'
      }
    }
  }, [isOpen])

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()

  const prevMonth = () => {
    setViewDate(new Date(year, month - 1, 1))
  }

  const nextMonth = () => {
    setViewDate(new Date(year, month + 1, 1))
  }

  const selectDate = (day) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    onChange({ target: { value: dateStr } })
    setIsOpen(false)
  }

  const isDisabled = (day) => {
    const d = new Date(year, month, day)
    if (maxDate && d > maxDate) return true
    if (minDate && d < minDate) return true
    return false
  }

  const isSelected = (day) => {
    if (!selectedDate) return false
    return selectedDate.getFullYear() === year && selectedDate.getMonth() === month && selectedDate.getDate() === day
  }

  const isToday = (day) => {
    const today = new Date()
    return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
  }

  const formatDisplayDate = () => {
    if (!selectedDate) return ''
    return `${String(selectedDate.getDate()).padStart(2, '0')}/${MONTH_SHORT[selectedDate.getMonth()]}/${selectedDate.getFullYear()}`
  }

  const goToToday = () => {
    const today = new Date()
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    if (maxDate && today > maxDate) return
    if (minDate && today < minDate) return
    onChange({ target: { value: dateStr } })
    setViewDate(today)
    setIsOpen(false)
  }

  // Calendar grid cells
  const cells = []
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="input flex items-center justify-between gap-2 cursor-pointer text-left"
      >
        <span className={selectedDate ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-[#636366]'}>
          {formatDisplayDate() || placeholder}
        </span>
        <Calendar className="h-4 w-4 text-gray-400 dark:text-[#636366] flex-shrink-0" />
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 z-50 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-xl shadow-lg p-3 w-[280px] min-w-[280px]"
          style={{ marginTop: '4px' }}
        >
          {/* Month/Year Nav */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-colors">
              <ChevronLeft className="h-4 w-4 text-gray-600 dark:text-[#8E8E93]" />
            </button>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {MONTH_NAMES[month]} {year}
            </span>
            <button type="button" onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-colors">
              <ChevronRight className="h-4 w-4 text-gray-600 dark:text-[#8E8E93]" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-medium text-gray-400 dark:text-[#636366] py-1">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, idx) => {
              if (!day) return <div key={idx} />
              const disabled_ = isDisabled(day)
              const selected = isSelected(day)
              const today = isToday(day)
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => !disabled_ && selectDate(day)}
                  disabled={disabled_}
                  className={`h-8 w-full rounded-lg text-xs font-medium transition-all
                    ${selected
                      ? 'bg-primary-500 text-white shadow-sm'
                      : today
                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-semibold'
                        : disabled_
                          ? 'text-gray-300 dark:text-[#48484A] cursor-not-allowed'
                          : 'text-gray-700 dark:text-[#8E8E93] hover:bg-gray-100 dark:hover:bg-[#2C2C2E]'
                    }`}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Today shortcut */}
          <div className="mt-2 pt-2 border-t border-gray-100 dark:border-[#38383A] flex justify-center">
            <button
              type="button"
              onClick={goToToday}
              className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium px-3 py-1 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default DatePicker
