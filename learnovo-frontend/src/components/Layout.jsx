import React, { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Sidebar from './Sidebar'
import Header from './Header'
import MobileHeader from './MobileHeader'
import Search from '../pages/Search'

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false) // Start closed on mobile
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Close sidebar on mobile when route changes
  React.useEffect(() => {
    if (window.innerWidth < 768) {
      setSidebarOpen(false)
    } else {
      setSidebarOpen(true) // Open on desktop
    }
  }, [location])

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-64">
        {/* Mobile Header */}
        <MobileHeader
          onMenuClick={toggleSidebar}
          onSearchClick={() => {/* Handle search */ }}
        />

        {/* Desktop Header */}
        <div className="hidden lg:block">
          <Header
            onToggleSidebar={toggleSidebar}
            sidebarOpen={sidebarOpen}
          />
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50">
          <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export default Layout
