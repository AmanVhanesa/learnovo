import React, { useState, useRef, useEffect } from 'react'
import { Clock, ChevronUp, ChevronDown } from 'lucide-react'

const TimePicker = ({ value, onChange, placeholder = 'Select time', className = '', disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  const dropdownRef = useRef(null)

  // Parse HH:MM value
  const parseTime = (val) => {
    if (!val) return { hours: 12, minutes: 0, period: 'AM' }
    const [h, m] = val.split(':').map(Number)
    return {
      hours: h === 0 ? 12 : h > 12 ? h - 12 : h,
      minutes: m || 0,
      period: h >= 12 ? 'PM' : 'AM'
    }
  }

  const [time, setTime] = useState(() => parseTime(value))

  useEffect(() => {
    setTime(parseTime(value))
  }, [value])

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

  // Position dropdown
  useEffect(() => {
    if (isOpen && dropdownRef.current && containerRef.current) {
      const trigger = containerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - trigger.bottom
      const spaceAbove = trigger.top
      const dropdown = dropdownRef.current

      if (spaceBelow < 220 && spaceAbove > spaceBelow) {
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

  const emitChange = (newTime) => {
    let h24 = newTime.hours
    if (newTime.period === 'AM' && h24 === 12) h24 = 0
    else if (newTime.period === 'PM' && h24 !== 12) h24 += 12
    const val = `${String(h24).padStart(2, '0')}:${String(newTime.minutes).padStart(2, '0')}`
    onChange({ target: { value: val } })
  }

  const adjustHours = (dir) => {
    setTime(prev => {
      const newH = dir === 'up' ? (prev.hours % 12) + 1 : (prev.hours === 1 ? 12 : prev.hours - 1)
      const newTime = { ...prev, hours: newH }
      emitChange(newTime)
      return newTime
    })
  }

  const adjustMinutes = (dir) => {
    setTime(prev => {
      let newM = dir === 'up' ? prev.minutes + 5 : prev.minutes - 5
      if (newM >= 60) newM = 0
      if (newM < 0) newM = 55
      const newTime = { ...prev, minutes: newM }
      emitChange(newTime)
      return newTime
    })
  }

  const togglePeriod = () => {
    setTime(prev => {
      const newTime = { ...prev, period: prev.period === 'AM' ? 'PM' : 'AM' }
      emitChange(newTime)
      return newTime
    })
  }

  const formatDisplay = () => {
    if (!value) return ''
    return `${String(time.hours).padStart(2, '0')}:${String(time.minutes).padStart(2, '0')} ${time.period}`
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="input flex items-center justify-between gap-2 cursor-pointer text-left"
      >
        <span className={value ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-[#636366]'}>
          {formatDisplay() || placeholder}
        </span>
        <Clock className="h-4 w-4 text-gray-400 dark:text-[#636366] flex-shrink-0" />
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute left-0 z-50 bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-xl shadow-lg p-4 w-[200px]"
        >
          <div className="flex items-center justify-center gap-2">
            {/* Hours */}
            <div className="flex flex-col items-center">
              <button type="button" onClick={() => adjustHours('up')} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-colors">
                <ChevronUp className="h-4 w-4 text-gray-500 dark:text-[#8E8E93]" />
              </button>
              <span className="text-2xl font-semibold text-gray-900 dark:text-white w-10 text-center tabular-nums">
                {String(time.hours).padStart(2, '0')}
              </span>
              <button type="button" onClick={() => adjustHours('down')} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-colors">
                <ChevronDown className="h-4 w-4 text-gray-500 dark:text-[#8E8E93]" />
              </button>
            </div>

            <span className="text-2xl font-semibold text-gray-400 dark:text-[#636366] -mt-0.5">:</span>

            {/* Minutes */}
            <div className="flex flex-col items-center">
              <button type="button" onClick={() => adjustMinutes('up')} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-colors">
                <ChevronUp className="h-4 w-4 text-gray-500 dark:text-[#8E8E93]" />
              </button>
              <span className="text-2xl font-semibold text-gray-900 dark:text-white w-10 text-center tabular-nums">
                {String(time.minutes).padStart(2, '0')}
              </span>
              <button type="button" onClick={() => adjustMinutes('down')} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-colors">
                <ChevronDown className="h-4 w-4 text-gray-500 dark:text-[#8E8E93]" />
              </button>
            </div>

            {/* AM/PM */}
            <button
              type="button"
              onClick={togglePeriod}
              className="ml-1 px-2.5 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 text-sm font-semibold hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
            >
              {time.period}
            </button>
          </div>

          {/* Quick presets */}
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-[#38383A] flex flex-wrap gap-1.5 justify-center">
            {['08:00', '09:00', '10:00', '12:00', '14:00', '16:00'].map(preset => {
              const [h, m] = preset.split(':').map(Number)
              const label = `${h > 12 ? h - 12 : h}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    onChange({ target: { value: preset } })
                    setTime(parseTime(preset))
                    setIsOpen(false)
                  }}
                  className={`text-[10px] px-2 py-1 rounded-md transition-colors ${
                    value === preset
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-600 dark:text-[#8E8E93] hover:bg-gray-200 dark:hover:bg-[#38383A]'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default TimePicker
