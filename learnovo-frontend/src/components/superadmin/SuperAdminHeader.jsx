import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Menu, Search, LogOut, ChevronDown, ChevronRight, Bell, Sun, Moon } from 'lucide-react'
import { useSuperAdminAuth } from '../../contexts/SuperAdminContext'
import { useTheme } from '../../contexts/ThemeContext'

const PAGE_TITLES = {
    '/super-admin/dashboard': 'Dashboard',
    '/super-admin/schools': 'Tenants (Schools)',
    '/super-admin/users': 'Users',
    '/super-admin/plans': 'Subscriptions & Plans',
    '/super-admin/billing': 'Billing & Payments',
    '/super-admin/modules': 'Modules',
    '/super-admin/communication': 'Communication',
    '/super-admin/support': 'Support & Helpdesk',
    '/super-admin/reports': 'Reports & Analytics',
    '/super-admin/audit-log': 'Audit Logs',
    '/super-admin/settings': 'Platform Settings',
    '/super-admin/system': 'System Health',
}

const SuperAdminHeader = ({ onToggleSidebar }) => {
    const { superAdmin, logout } = useSuperAdminAuth()
    const { theme, toggleMode } = useTheme()
    const navigate = useNavigate()
    const location = useLocation()
    const [searchQuery, setSearchQuery] = useState('')
    const [profileOpen, setProfileOpen] = useState(false)
    const dropdownRef = useRef(null)

    const pageTitle = PAGE_TITLES[location.pathname] || 'Dashboard'

    const handleSearch = (e) => {
        e.preventDefault()
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
        <header className="bg-white dark:bg-[#1C1C1E] shadow-sm border-b border-gray-200 dark:border-[#38383A]">
            <div className="flex items-center justify-between h-14 px-3 sm:px-4 md:px-6">
                {/* Left: hamburger + breadcrumb */}
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <button
                        onClick={onToggleSidebar}
                        className="xl:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-[#2C2C2E] focus:outline-none flex-shrink-0"
                    >
                        <Menu className="h-5 w-5" />
                    </button>
                    {/* Breadcrumb */}
                    <nav className="flex items-center gap-1.5 text-sm min-w-0">
                        <Link to="/super-admin/dashboard" className="text-gray-400 dark:text-[#636366] hover:text-gray-600 dark:hover:text-white transition-colors hidden sm:inline">
                            Super Admin
                        </Link>
                        <ChevronRight className="h-3.5 w-3.5 text-gray-300 dark:text-[#636366] hidden sm:block flex-shrink-0" />
                        <span className="font-medium text-gray-900 dark:text-white truncate text-sm">{pageTitle}</span>
                    </nav>
                </div>

                {/* Right: search + profile */}
                <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                    <form onSubmit={handleSearch} className="hidden md:block">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-[#636366]" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="block w-56 pl-9 pr-3 py-1.5 border border-gray-200 dark:border-[#38383A] rounded-lg text-sm bg-gray-50 dark:bg-[#1C1C1E] dark:text-white placeholder-gray-400 dark:placeholder-[#636366] focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 focus:bg-white dark:focus:bg-[#1C1C1E] transition-colors"
                                placeholder="Search..."
                            />
                        </div>
                    </form>

                    {/* Dark/Light mode toggle */}
                    <button
                        onClick={toggleMode}
                        className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-[#8E8E93] dark:hover:text-white dark:hover:bg-[#2C2C2E] transition-colors focus:outline-none"
                        aria-label={theme.mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                    >
                        {theme.mode === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                    </button>

                    {/* Profile dropdown */}
                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setProfileOpen(o => !o)}
                            className="flex items-center gap-2 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2C2C2E] transition-colors focus:outline-none"
                        >
                            <div className="h-8 w-8 rounded-full overflow-hidden bg-primary-500 flex-shrink-0 flex items-center justify-center">
                                <span className="text-xs font-bold text-white">{initials}</span>
                            </div>
                            <div className="hidden md:block text-left">
                                <p className="text-sm font-medium text-gray-900 dark:text-white leading-tight">{displayName}</p>
                            </div>
                            <ChevronDown className={`h-3.5 w-3.5 text-gray-400 hidden md:block transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {profileOpen && (
                            <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-[#1C1C1E] rounded-xl shadow-lg border border-gray-100 dark:border-[#38383A] py-1 z-50 animate-scale-in">
                                <div className="px-4 py-3 border-b border-gray-100 dark:border-[#38383A]">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{displayName}</p>
                                    <p className="text-xs text-primary-600 truncate">{superAdmin?.email}</p>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
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
