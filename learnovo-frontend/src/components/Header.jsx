import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Menu, Search, LogOut, Settings, ChevronDown, Sun, Moon } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { useUserDisplay } from '../hooks/useUserDisplay'
import { useClickOutside } from '../hooks/useClickOutside'
import NotificationBell from './NotificationBell'
import UserAvatar from './UserAvatar'

const PAGE_TITLES = {
  '/app/dashboard': 'Dashboard',
  '/app/students': 'Student Management',
  '/app/student-lists': 'Student Lists',
  '/app/employees': 'Employee Management',
  '/app/fees-finance': 'Fees & Finance',
  '/app/admissions': 'Admission Management',
  '/app/reports': 'Reports & Analytics',
  '/app/notifications': 'Notifications',
  '/app/settings': 'Settings',
  '/app/profile': 'Profile',
  '/app/attendance': 'Attendance',
  '/app/academics': 'Academics',
  '/app/homework': 'Homework',
  '/app/exams': 'Exams & Results',
  '/app/transport': 'Transport',
  '/app/communication': 'Communication',
  '/app/certificates': 'Certificates',
  '/app/certificates/generate': 'Certificates > Generate',
  '/app/certificates/templates': 'Certificates > Templates',
  '/app/payroll': 'Payroll',
  '/app/assignments': 'Assignments',
  '/app/expenses': 'Expenses',
}

const Header = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth()
  const { theme, toggleMode } = useTheme()
  const { photoUrl, displayName, initials, role } = useUserDisplay()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchQuery, setSearchQuery] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)
  const dropdownRef = useRef(null)

  useClickOutside(dropdownRef, useCallback(() => setProfileOpen(false), []))

  const pageTitle = PAGE_TITLES[location.pathname] || 'Dashboard'

  // Clear search when navigating away from search page
  useEffect(() => {
    if (!location.pathname.includes('/search')) {
      setSearchQuery('')
    }
  }, [location.pathname])

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/app/search?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="bg-white/95 dark:bg-[#000000] backdrop-blur-xl border-b border-gray-100 dark:border-[#38383A]">
      <div className="flex items-center justify-between h-16 px-6">
        {/* Left: hamburger + page title */}
        <div className="flex items-center">
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-[#2C2C2E] dark:hover:text-white focus:outline-none"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="ml-3 lg:ml-0">
            <h1 className="text-lg font-semibold text-gray-800 dark:text-white tracking-tight">{pageTitle}</h1>
          </div>
        </div>

        {/* Right: search + notifications + profile */}
        <div className="flex items-center gap-2">
          {/* Search bar */}
          <form onSubmit={handleSearch} className="hidden md:block">
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-64 lg:w-72 pl-10 pr-4 py-2 border-0 rounded-xl bg-gray-100 dark:bg-[#1C1C1E] dark:border dark:border-[#38383A] placeholder-gray-400 dark:placeholder-[#636366] text-gray-900 dark:text-white text-sm focus:outline-none focus:bg-white dark:bg-[#1C1C1E] focus:ring-2 focus:ring-primary-500 dark:focus:bg-[#2C2C2E] dark:focus:ring-[#3EC4B1] transition-all duration-200"
                placeholder="Search..."
              />
            </div>
          </form>

          {/* Dark/Light mode toggle */}
          <button
            onClick={toggleMode}
            className="p-2 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-[#8E8E93] dark:hover:text-white dark:hover:bg-[#2C2C2E] transition-colors focus:outline-none"
            aria-label={theme.mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme.mode === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          <NotificationBell />

          {/* Profile dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setProfileOpen(o => !o)}
              className="flex items-center gap-2.5 py-1.5 px-2 rounded-xl hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-all duration-200 focus:outline-none"
            >
              <UserAvatar photoUrl={photoUrl} initials={initials} alt={user?.name} size="sm" />
              <div className="hidden md:block text-left">
                <p className="text-sm font-semibold text-gray-800 dark:text-white leading-tight">{displayName}</p>
                <p className="text-[11px] text-gray-400 dark:text-[#8E8E93] capitalize">{role}</p>
              </div>
              <ChevronDown className={`h-3.5 w-3.5 text-gray-400 hidden md:block transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`} />
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-1rem)] bg-white/95 dark:bg-[#2C2C2E] backdrop-blur-xl rounded-2xl shadow-glass-lg ring-1 ring-black/[0.04] dark:ring-[#48484A] py-1 z-50 animate-slide-down">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-[#38383A]">
                  <div className="flex items-center gap-3">
                    <UserAvatar photoUrl={photoUrl} initials={initials} alt={user?.name} size="lg" />
                    <div className="overflow-hidden">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{displayName}</p>
                      <p className="text-xs text-gray-500 dark:text-[#8E8E93] capitalize">{role}</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => { navigate('/app/profile'); setProfileOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-[#3A3A3C] transition-colors"
                >
                  <Settings className="h-4 w-4 text-gray-400 dark:text-[#636366]" />
                  Edit Profile
                </button>

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
    </header>
  )
}

export default Header
