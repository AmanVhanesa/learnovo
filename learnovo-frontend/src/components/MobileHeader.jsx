import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Search, Settings, LogOut, ChevronDown } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import NotificationBell from './NotificationBell'

const SERVER_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5001').replace(/\/api\/?$/, '')

const MobileHeader = ({ onMenuClick }) => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [profileOpen, setProfileOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Resolve photo URL (Cloudinary or relative path)
  const photoUrl = (() => {
    const raw = user?.avatar || user?.photo
    if (!raw) return null
    return raw.startsWith('http') ? raw : `${SERVER_URL}${raw}`
  })()

  const displayName = user?.fullName || user?.name || ''
  const initials = displayName.charAt(0)?.toUpperCase() || '?'

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="xl:hidden bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Left side - Menu button and logo */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onMenuClick}
            className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <Menu className="h-5 w-5 text-gray-600" />
          </button>
          <img
            src="/logo-icon.png"
            alt="Learnovo"
            className="h-8 w-8 object-contain"
          />
          <h1 className="text-lg font-semibold text-gray-900">Learnovo</h1>
        </div>

        {/* Right side - Search, notifications, profile */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => navigate('/app/search')}
            className="p-2 rounded-md hover:bg-gray-100 focus:outline-none"
          >
            <Search className="h-5 w-5 text-gray-600" />
          </button>

          <NotificationBell />

          {/* Profile dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setProfileOpen(o => !o)}
              className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none"
            >
              {/* Avatar circle */}
              <div className="h-9 w-9 rounded-full overflow-hidden bg-primary-500 flex items-center justify-center flex-shrink-0">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={user?.name}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none'
                      e.target.parentElement.querySelector('span').style.display = 'flex'
                    }}
                  />
                ) : null}
                <span
                  className="text-sm font-medium text-white"
                  style={{ display: photoUrl ? 'none' : 'flex' }}
                >
                  {initials}
                </span>
              </div>
              <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {profileOpen && (
              <div className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-[200]">
                {/* User info header */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-full overflow-hidden bg-primary-500 flex items-center justify-center flex-shrink-0">
                      {photoUrl ? (
                        <img
                          src={photoUrl}
                          alt={user?.name}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none'
                            e.target.nextSibling.style.display = 'flex'
                          }}
                        />
                      ) : null}
                      <span
                        className="text-sm font-semibold text-white"
                        style={{ display: photoUrl ? 'none' : 'flex' }}
                      >
                        {initials}
                      </span>
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                      <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
                    </div>
                  </div>
                </div>

                {/* Edit Profile */}
                <button
                  onClick={() => { navigate('/app/profile'); setProfileOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Settings className="h-4 w-4 text-gray-400" />
                  Edit Profile
                </button>

                {/* Sign out */}
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
    </div>
  )
}

export default MobileHeader
