import React, { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Search, Settings, LogOut, ChevronDown, Sun, Moon } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useUserDisplay } from '../hooks/useUserDisplay'
import { useClickOutside } from '../hooks/useClickOutside'
import NotificationBell from './NotificationBell'
import UserAvatar from './UserAvatar'

const MobileHeader = ({ onMenuClick }) => {
  const { logout } = useAuth()
  const { theme, toggleMode } = useTheme()
  const { photoUrl, displayName, initials, role } = useUserDisplay()
  const navigate = useNavigate()
  const [profileOpen, setProfileOpen] = useState(false)
  const dropdownRef = useRef(null)

  useClickOutside(dropdownRef, useCallback(() => setProfileOpen(false), []))

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="xl:hidden bg-white/95 dark:bg-[#1C1C1E] backdrop-blur-xl border-b border-gray-200/60 dark:border-[#2C2C2E] sticky top-0 z-30">
      <div className="flex items-center justify-between h-14 px-3">
        {/* Left side - Menu button and logo */}
        <div className="flex items-center space-x-2 min-w-0">
          <button
            onClick={onMenuClick}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-[#2C2C2E] focus:outline-none focus:ring-2 focus:ring-primary-500 flex-shrink-0"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5 text-gray-600 dark:text-[#8E8E93]" />
          </button>
          <img
            src="/logo-icon.png"
            alt="Learnovo"
            className="h-7 w-7 object-contain flex-shrink-0"
          />
          <h1 className="text-base font-semibold text-gray-900 dark:text-white truncate">Learnovo</h1>
        </div>

        {/* Right side - Search, notifications, profile */}
        <div className="flex items-center space-x-0.5 flex-shrink-0">
          <button
            onClick={() => navigate('/app/search')}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-[#2C2C2E] focus:outline-none"
            aria-label="Search"
          >
            <Search className="h-5 w-5 text-gray-600 dark:text-[#8E8E93]" />
          </button>

          {/* Dark/Light mode toggle */}
          <button
            onClick={toggleMode}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-[#2C2C2E] focus:outline-none"
            aria-label={theme.mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme.mode === 'dark' ? <Sun className="h-5 w-5 text-[#8E8E93]" /> : <Moon className="h-5 w-5 text-gray-600" />}
          </button>

          <NotificationBell />

          {/* Profile dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setProfileOpen(o => !o)}
              className="flex items-center gap-1 p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-colors focus:outline-none"
              aria-label="Profile menu"
            >
              <UserAvatar photoUrl={photoUrl} initials={initials} alt={displayName} size="sm" />
              <ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown — right-aligned and constrained to viewport */}
            {profileOpen && (
              <div className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-2rem)] bg-white/95 dark:bg-[#1C1C1E] backdrop-blur-xl rounded-2xl shadow-glass-lg ring-1 ring-black/[0.04] dark:ring-white/[0.06] py-1 z-[200] animate-slide-down">
                {/* User info header */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-[#38383A]">
                  <div className="flex items-center gap-3">
                    <UserAvatar photoUrl={photoUrl} initials={initials} alt={displayName} size="lg" />
                    <div className="overflow-hidden">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{displayName}</p>
                      <p className="text-xs text-gray-500 dark:text-[#8E8E93] capitalize">{role}</p>
                    </div>
                  </div>
                </div>

                {/* Edit Profile */}
                <button
                  onClick={() => { navigate('/app/profile'); setProfileOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition-colors"
                >
                  <Settings className="h-4 w-4 text-gray-400 dark:text-[#636366]" />
                  Edit Profile
                </button>

                {/* Sign out */}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default MobileHeader
