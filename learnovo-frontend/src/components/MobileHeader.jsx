import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Bell, Search } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const MobileHeader = ({ onMenuClick, onSearchClick }) => {
  const { user } = useAuth()
  const navigate = useNavigate()

  const handleSearchClick = () => {
    navigate('/app/search')
  }

  return (
    <div className="xl:hidden bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Left side - Menu button and title */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onMenuClick}
            className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <Menu className="h-5 w-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Learnovo</h1>
        </div>

        {/* Right side - Search and notifications */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleSearchClick}
            className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <Search className="h-5 w-5 text-gray-600" />
          </button>

          <button className="relative p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500">
            <Bell className="h-5 w-5 text-gray-600" />
            <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              3
            </span>
          </button>

          {/* User avatar */}
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 bg-primary-500 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-white">
                {user?.name?.charAt(0) || 'U'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MobileHeader
