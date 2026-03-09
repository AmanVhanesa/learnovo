import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Menu, Search, LogOut, ChevronDown } from 'lucide-react'
import { useSuperAdminAuth } from '../../contexts/SuperAdminContext'

const PAGE_TITLES = {
    '/super-admin/dashboard': 'Super Admin Dashboard',
    '/super-admin/schools': 'All Schools',
    '/super-admin/users': 'All Users',
    '/super-admin/plans': 'Plan Configuration',
    '/super-admin/audit-log': 'Audit Log',
}

const SuperAdminHeader = ({ onToggleSidebar }) => {
    const { superAdmin, logout } = useSuperAdminAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const [searchQuery, setSearchQuery] = useState('')
    const [profileOpen, setProfileOpen] = useState(false)
    const dropdownRef = useRef(null)

    const pageTitle = PAGE_TITLES[location.pathname] || 'Super Admin Dashboard'

    const handleSearch = (e) => {
        e.preventDefault()
        // In a real app we might have a super admin search page
    }

    const handleLogout = () => {
        logout()
        navigate('/super-admin-login')
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

    const displayName = superAdmin?.name || 'Super Admin'
    const initials = displayName.charAt(0)?.toUpperCase() || 'S'

    return (
        <header className="bg-white shadow-sm border-b border-gray-200">
            <div className="flex items-center justify-between h-16 px-6">
                {/* Left: hamburger + page title */}
                <div className="flex items-center">
                    <button
                        onClick={onToggleSidebar}
                        className="xl:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
                    >
                        <Menu className="h-6 w-6" />
                    </button>
                    <div className="ml-4">
                        <h1 className="text-xl font-semibold text-gray-900">{pageTitle}</h1>
                        {location.pathname === '/super-admin/dashboard' && (
                            <p className="text-sm text-gray-500 -mt-1 hidden sm:block">Platform overview & tenant management</p>
                        )}
                    </div>
                </div>

                {/* Right: search + profile */}
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
                                placeholder="Search schools or users..."
                            />
                        </div>
                    </form>

                    {/* Profile dropdown */}
                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setProfileOpen(o => !o)}
                            className="flex items-center space-x-2 p-1 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none"
                        >
                            {/* Avatar */}
                            <div className="h-9 w-9 rounded-full overflow-hidden bg-primary-500 flex-shrink-0 flex items-center justify-center">
                                <span className="text-sm font-medium text-white items-center justify-center flex">
                                    {initials}
                                </span>
                            </div>
                            {/* Name + role */}
                            <div className="hidden md:block text-left">
                                <p className="text-sm font-medium text-gray-900 leading-tight">{displayName}</p>
                                <p className="text-xs text-primary-600 font-medium capitalize">Super Admin</p>
                            </div>
                            <ChevronDown className={`h-4 w-4 text-gray-400 hidden md:block transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {profileOpen && (
                            <div className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-1rem)] bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                                <div className="px-4 py-3 border-b border-gray-100">
                                    <div className="flex items-center gap-3">
                                        <div className="h-11 w-11 rounded-full overflow-hidden bg-primary-500 flex items-center justify-center flex-shrink-0">
                                            <span className="text-sm font-semibold text-white flex">{initials}</span>
                                        </div>
                                        <div className="overflow-hidden">
                                            <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                                            <p className="text-xs text-primary-600 font-medium capitalize">Super Admin</p>
                                        </div>
                                    </div>
                                </div>

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

export default SuperAdminHeader
