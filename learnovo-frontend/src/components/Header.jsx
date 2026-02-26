import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Menu, Search, LogOut, Settings, ChevronDown } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import NotificationBell from './NotificationBell'

const SERVER_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5001').replace(/\/api\/?$/, '')

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
  '/app/payroll': 'Payroll',
}

const Header = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchQuery, setSearchQuery] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)
  const dropdownRef = useRef(null)

  const pageTitle = PAGE_TITLES[location.pathname] || 'Dashboard'

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

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const photoUrl = user?.photo
    ? (user.photo.startsWith('http') ? user.photo : `${SERVER_URL}${user.photo}`)
    : null

  const initials = user?.name?.charAt(0)?.toUpperCase() || '?'

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="flex items-center justify-between h-16 px-6">
        {/* Left: hamburger + page title */}
        <div className="flex items-center">
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="ml-4">
            <h1 className="text-xl font-semibold text-gray-900">{pageTitle}</h1>
          </div>
        </div>

        {/* Right: search + notifications + profile */}
        <div className="flex items-center space-x-4">
          <form onSubmit={handleSearch} className="hidden md:block">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                placeholder="Search students, fees, homework..."
              />
            </div>
          </form>

          <NotificationBell />

          {/* Profile dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setProfileOpen(o => !o)}
              className="flex items-center space-x-2 p-1 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none"
            >
              <div className="h-8 w-8 rounded-full overflow-hidden bg-primary-500 flex items-center justify-center flex-shrink-0">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={user?.name}
                    className="h-full w-full object-cover"
                    onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
                  />
                ) : null}
                <span
                  className="text-sm font-medium text-white"
                  style={{ display: photoUrl ? 'none' : 'flex' }}
                >
                  {initials}
                </span>
              </div>
              <div className="hidden md:block text-left">
                <p className="text-sm font-medium text-gray-900 leading-tight">{user?.name}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
              </div>
              <ChevronDown className={`h-4 w-4 text-gray-400 hidden md:block transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full overflow-hidden bg-primary-500 flex items-center justify-center flex-shrink-0">
                      {photoUrl ? (
                        <img src={photoUrl} alt={user?.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-sm font-semibold text-white">{initials}</span>
                      )}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
                      <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => { navigate('/app/profile'); setProfileOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Settings className="h-4 w-4 text-gray-400" />
                  Edit Profile
                </button>

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
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
