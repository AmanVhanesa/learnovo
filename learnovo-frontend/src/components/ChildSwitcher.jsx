import React, { useState, useRef, useCallback } from 'react'
import { Users, ChevronDown, Check, ArrowRightLeft, Loader2 } from 'lucide-react'
import { useChild } from '../contexts/ChildContext'
import { useClickOutside } from '../hooks/useClickOutside'
import { useAuth } from '../contexts/AuthContext'
import UserAvatar from './UserAvatar'

const ChildSwitcher = ({ compact = false }) => {
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

  // For students, the "selected" is themselves
  const currentUser = isStudent
    ? {
        name: user?.fullName || user?.name || '',
        avatar: user?.avatar || user?.photo || null,
        className: user?.class?.name || '',
        sectionName: user?.section?.name || ''
      }
    : selectedChild

  const firstName = currentUser?.name?.split(' ')[0] || ''
  const currentId = isStudent ? (user?.id || user?._id) : selectedChild?.id

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        disabled={switching}
        className={`flex items-center gap-1.5 rounded-xl transition-all duration-200 focus:outline-none ${
          compact
            ? 'py-1 px-2 bg-primary-50 dark:bg-[rgba(62,196,177,0.1)] hover:bg-primary-100 dark:hover:bg-[rgba(62,196,177,0.18)] ring-1 ring-primary-200 dark:ring-[rgba(62,196,177,0.2)]'
            : 'py-1.5 px-3 bg-primary-50 dark:bg-[rgba(62,196,177,0.1)] hover:bg-primary-100 dark:hover:bg-[rgba(62,196,177,0.18)] ring-1 ring-primary-200 dark:ring-[rgba(62,196,177,0.2)]'
        }`}
      >
        {switching ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary-500" />
        ) : (
          <>
            {currentUser?.avatar ? (
              <UserAvatar photoUrl={currentUser.avatar} initials={getInitials(currentUser.name)} alt={currentUser.name} size="sm" />
            ) : (
              <div className={`${compact ? 'h-6 w-6' : 'h-7 w-7'} rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0`}>
                <span className={`${compact ? 'text-[10px]' : 'text-[11px]'} font-semibold text-white`}>{getInitials(currentUser?.name)}</span>
              </div>
            )}
          </>
        )}
        {compact ? (
          <span className="text-xs font-medium text-primary-700 dark:text-[#3EC4B1] max-w-[80px] truncate">
            {firstName}
          </span>
        ) : (
          <div className="text-left">
            <p className="text-sm font-medium text-gray-800 dark:text-white leading-tight truncate max-w-[120px]">
              {currentUser?.name}
            </p>
            <p className="text-[10px] text-gray-500 dark:text-[#8E8E93] leading-tight hidden sm:block">
              {currentUser?.className}{currentUser?.sectionName ? ` - ${currentUser.sectionName}` : ''}
            </p>
          </div>
        )}
        <ChevronDown className={`h-3 w-3 text-gray-400 dark:text-[#8E8E93] transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && !switching && (
        <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:top-auto sm:left-0 sm:right-auto sm:mt-2 sm:w-64 bg-white/95 dark:bg-[#2C2C2E] backdrop-blur-xl rounded-2xl shadow-glass-lg ring-1 ring-gray-200 dark:ring-[#38383A] py-1 z-[100] animate-slide-down">
          {/* Header */}
          <div className="px-4 py-2.5 border-b border-gray-100 dark:border-[#38383A]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isStudent ? (
                  <ArrowRightLeft className="h-4 w-4 text-primary-500 dark:text-[#3EC4B1]" />
                ) : (
                  <Users className="h-4 w-4 text-primary-500 dark:text-[#3EC4B1]" />
                )}
                <p className="text-xs font-semibold text-gray-500 dark:text-[#8E8E93] uppercase tracking-wide">
                  {isStudent ? 'Switch Account' : 'Switch Child'}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="sm:hidden p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#3A3A3C]"
              >
                <span className="text-xs font-medium">Done</span>
              </button>
            </div>
          </div>

          {/* Children / siblings list */}
          <div className="py-1 max-h-60 overflow-y-auto">
            {childrenList.map((child) => {
              const isSelected = child.id === currentId || (child.id === (user?.id || user?._id))
              const isSelf = child.isSelf
              return (
                <button
                  key={child.id}
                  onClick={() => {
                    if (!isSelected) {
                      selectChild(child.id)
                    }
                    setOpen(false)
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    isSelected
                      ? 'bg-primary-50 dark:bg-[rgba(62,196,177,0.1)]'
                      : 'hover:bg-gray-50 dark:hover:bg-[#3A3A3C]'
                  }`}
                >
                  {child.avatar ? (
                    <UserAvatar photoUrl={child.avatar} initials={getInitials(child.name)} alt={child.name} size="sm" />
                  ) : (
                    <div className={`h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'bg-primary-500' : 'bg-gray-300 dark:bg-[#48484A]'
                    }`}>
                      <span className="text-xs font-semibold text-white">{getInitials(child.name)}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${
                      isSelected ? 'text-primary-700 dark:text-[#3EC4B1]' : 'text-gray-800 dark:text-white'
                    }`}>
                      {child.name}
                      {isSelf && <span className="text-[10px] ml-1.5 text-gray-400 dark:text-[#636366]">(You)</span>}
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
