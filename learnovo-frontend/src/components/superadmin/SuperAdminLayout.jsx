import React, { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import SuperAdminSidebar from './SuperAdminSidebar'
import SuperAdminHeader from './SuperAdminHeader'

const SuperAdminLayout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const location = useLocation()

    // Close sidebar on mobile/tablet when route changes, open only on large desktops
    React.useEffect(() => {
        if (window.innerWidth < 1280) { // xl breakpoint (1280px)
            setSidebarOpen(false)
        } else {
            setSidebarOpen(true) // Open on large desktop
        }
    }, [location])

    const toggleSidebar = () => {
        setSidebarOpen(!sidebarOpen)
    }

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            {/* Sidebar */}
            <SuperAdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

            {/* Main content area */}
            <div className="flex-1 flex flex-col min-h-0 xl:ml-[210px]">
                {/* Header — flush at the very top, no extra padding */}
                <SuperAdminHeader
                    onToggleSidebar={toggleSidebar}
                    sidebarOpen={sidebarOpen}
                />

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

export default SuperAdminLayout
