import React from 'react'
import { GraduationCap, Users, DoorOpen } from 'lucide-react'

const VIEW_OPTIONS = [
  { key: 'class', label: 'Class View', icon: GraduationCap },
  { key: 'teacher', label: 'Teacher View', icon: Users },
  { key: 'room', label: 'Room View', icon: DoorOpen }
]

const ViewSwitcher = ({ activeView = 'class', onChange, className = '' }) => {
  return (
    <div className={`inline-flex items-center rounded-xl bg-gray-100 dark:bg-[#2C2C2E] p-1 ${className}`}>
      {VIEW_OPTIONS.map(({ key, label, icon: Icon }) => {
        const isActive = activeView === key
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange?.(key)}
            className={`
              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150
              focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1
              ${isActive
                ? 'bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white'
              }
            `}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        )
      })}
    </div>
  )
}

export default ViewSwitcher
