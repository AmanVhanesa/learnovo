import React from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useSuperAdminAuth } from '../../contexts/SuperAdminContext'
import { cn } from '../../utils/cn'
import {
    LayoutDashboard,
    School,
    Users,
    CreditCard,
    History,
    LogOut,
    X,
    GraduationCap
} from 'lucide-react'

const SuperAdminSidebar = ({ isOpen, onClose }) => {
    const { superAdmin, logout } = useSuperAdminAuth()
    const navigate = useNavigate()
    const location = useLocation()

    const handleLogout = () => {
        logout()
        navigate('/super-admin-login')
    }

    const initials = superAdmin?.name?.charAt(0)?.toUpperCase() || 'S'

    const menuItems = [
        { name: 'Dashboard', href: '/super-admin/dashboard', icon: LayoutDashboard },
        { name: 'Schools', href: '/super-admin/schools', icon: School },
        { name: 'Users', href: '/super-admin/users', icon: Users },
        { name: 'Plans Config', href: '/super-admin/plans', icon: CreditCard },
        { name: 'Audit Log', href: '/super-admin/audit-log', icon: History },
    ]

    return (
        <>
            {/* Mobile/Tablet overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 xl:hidden"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <div
                className={cn(
                    'fixed inset-y-0 left-0 z-50 w-[210px] bg-white shadow-lg transform transition-transform duration-300 ease-in-out flex flex-col',
                    'xl:translate-x-0',
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 flex-shrink-0">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <img
                                src="/logo-icon.png"
                                alt="Learnovo Logo"
                                className="h-9 w-9 object-contain"
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                    e.target.nextSibling.style.display = 'flex';
                                }}
                            />
                            <div className="h-9 w-9 bg-primary-500 rounded-lg items-center justify-center hidden">
                                <GraduationCap className="h-5 w-5 text-white" />
                            </div>
                        </div>
                        <div className="ml-3">
                            <h1 className="text-lg font-semibold text-gray-900">Learnovo</h1>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="xl:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto mt-4 px-4 pb-4">
                    <div className="space-y-2">
                        {menuItems.map((item) => (
                            <NavLink
                                key={item.name}
                                to={item.href}
                                className={({ isActive }) =>
                                    `group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${isActive
                                        ? 'bg-[#E8F8F5] text-primary-600 border-l-4 border-primary-500' // Matches the Teal active requested
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                    }`
                                }
                                onClick={() => {
                                    if (window.innerWidth < 1280) { // xl breakpoint
                                        onClose()
                                    }
                                }}
                            >
                                <item.icon
                                    className={`mr-3 h-5 w-5 flex-shrink-0 ${location.pathname === item.href
                                        ? 'text-primary-500' // Teal color
                                        : 'text-gray-400 group-hover:text-gray-500'
                                        }`}
                                />
                                {item.name}
                            </NavLink>
                        ))}
                    </div>
                </nav>

                {/* User Profile + Sign out */}
                <div className="p-4 border-t border-gray-200 flex-shrink-0 bg-white">
                    {/* Profile row */}
                    <div className="w-full flex items-center gap-3 mb-3 px-2 py-2 rounded-lg text-left">
                        <div className="h-10 w-10 rounded-full overflow-hidden bg-primary-500 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-white">
                                {initials}
                            </span>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-semibold text-gray-900 truncate">{superAdmin?.name || 'Super Admin'}</p>
                            <p className="text-xs text-primary-600 font-medium truncate">{superAdmin?.email || 'admin@learnovo.com'}</p>
                        </div>
                    </div>

                    {/* Sign out */}
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-md transition-colors duration-200"
                    >
                        <LogOut className="mr-3 h-4 w-4" />
                        Sign out
                    </button>
                </div>
            </div>
        </>
    )
}

export default SuperAdminSidebar
