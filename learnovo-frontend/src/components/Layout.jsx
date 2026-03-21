import React, { useState, useEffect, useCallback } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import MobileHeader from './MobileHeader'
import BottomNav from './BottomNav'
import PageErrorBoundary from './PageErrorBoundary'
import TrialBanner from './TrialBanner'
import { useMediaQuery } from '../hooks/useMediaQuery'

const Layout = () => {
  const isLargeDesktop = useMediaQuery('(min-width: 1280px)')
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  // Auto-open sidebar on large desktops, close on mobile/tablet when route changes
  useEffect(() => {
    setSidebarOpen(isLargeDesktop)
  }, [location, isLargeDesktop])

  // Close sidebar on Escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && sidebarOpen && !isLargeDesktop) {
        setSidebarOpen(false)
      }
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [sidebarOpen, isLargeDesktop])

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev)
  }, [])

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false)
  }, [])

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-[#000000]">
      {/* Mobile overlay backdrop — closes sidebar when tapping outside */}
      {sidebarOpen && !isLargeDesktop && (
        <div
          className="fixed inset-0 bg-black/30 dark:bg-black/50 z-20 xl:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden xl:ml-64">
        {/* Trial expiry banner */}
        <TrialBanner />

        {/* Mobile Header */}
        <MobileHeader onMenuClick={toggleSidebar} />

        {/* Desktop Header */}
        <div className="hidden xl:block relative z-30">
          <Header onToggleSidebar={toggleSidebar} />
        </div>

        {/* Page content */}
        <main className={`flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 dark:bg-[#000000] ${isMobile ? 'pb-20' : ''}`}>
          <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
            <PageErrorBoundary name={location.pathname}>
              <Outlet />
            </PageErrorBoundary>
          </div>
        </main>

        {/* Bottom navigation for mobile */}
        {isMobile && <BottomNav />}
      </div>
    </div>
  )
}

export default Layout
