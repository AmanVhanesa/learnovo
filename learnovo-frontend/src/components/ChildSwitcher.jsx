import React, { useState, useRef, useCallback } from 'react'
import { ArrowRightLeft, Check, Loader2 } from 'lucide-react'
import { useChild } from '../contexts/ChildContext'
import { useClickOutside } from '../hooks/useClickOutside'
import { useAuth } from '../contexts/AuthContext'
import UserAvatar from './UserAvatar'

const ChildSwitcher = () => {
  const { user } = useAuth()
  const { hasSwitcher, childrenList, selectedChild, selectChild, isParent, isStudent, switching } = useChild()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)

  useClickOutside(dropdownRef, useCallback(() => setOpen(false), []))

  if (!hasSwitcher) return null

  const getInitials = (name) => {
    if (!name) return '?'
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  }

  const currentId = isStudent ? (user?.id || user?._id) : selectedChild?.id
  const siblingCount = childrenList.length - (isStudent ? 1 : 0)

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Minimal icon button — same style as search/dark-mode/notification */}
      <button
        onClick={() => setOpen(o => !o)}
        disabled={switching}
        className="relative p-2 rounded-xl text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-colors focus:outline-none"
        aria-label="Switch account"
      >
        {switching ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary-500" />
        ) : (
          <ArrowRightLeft className="h-5 w-5" />
        )}
        {/* Sibling count badge */}
        {siblingCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center h-4 min-w-[16px] px-0.5 rounded-full bg-primary-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-[#1C1C1E] pointer-events-none">
            {siblingCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && !switching && (
        <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-64 bg-white/95 dark:bg-[#2C2C2E] backdrop-blur-xl rounded-2xl shadow-glass-lg ring-1 ring-gray-200 dark:ring-[#38383A] py-1 z-[100] animate-slide-down">
          {/* Header */}
          <div className="px-4 py-2.5 border-b border-gray-100 dark:border-[#38383A]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide">
                {isStudent ? 'Switch Account' : 'Switch Child'}
              </p>
              <button
                onClick={() => setOpen(false)}
                className="sm:hidden text-xs font-medium text-primary-600 dark:text-[#3EC4B1]"
              >
                Done
              </button>
            </div>
          </div>

          {/* List */}
          <div className="py-1 max-h-60 overflow-y-auto">
            {childrenList.map((child) => {
              const isSelected = child.id === currentId
              const isSelf = child.isSelf
              return (
                <button
                  key={child.id}
                  onClick={() => {
                    if (!isSelected) selectChild(child.id)
                    setOpen(false)
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    isSelected
                      ? 'bg-primary-50 dark:bg-[rgba(62,196,177,0.1)]'
                      : 'hover:bg-gray-50 dark:hover:bg-[#3A3A3C]'
                  }`}
                >
                  {child.avatar ? (
                    <UserAvatar photoUrl={child.avatar} initials={getInitials(child.name)} alt={child.name} size="sm" />
                  ) : (
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'bg-primary-500' : 'bg-gray-300 dark:bg-[#48484A]'
                    }`}>
                      <span className="text-[11px] font-semibold text-white">{getInitials(child.name)}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${
                      isSelected ? 'text-primary-700 dark:text-[#3EC4B1]' : 'text-gray-800 dark:text-white'
                    }`}>
                      {child.name}
                      {isSelf && <span className="text-[10px] ml-1 text-gray-400 dark:text-[#636366]">(You)</span>}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-[#8E8E93]">
                      {child.className}{child.sectionName ? ` - ${child.sectionName}` : ''}
                      {child.admissionNumber ? ` | ${child.admissionNumber}` : ''}
                    </p>
                  </div>
                  {isSelected && (
                    <Check className="h-4 w-4 text-primary-500 dark:text-[#3EC4B1] flex-shrink-0" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default ChildSwitcher
